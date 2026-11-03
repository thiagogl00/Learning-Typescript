// Sistema de tipos avançado
//
// Fundamento
//
// Um generic é uma função no nível dos tipos: recebe um tipo e devolve outro.
//
type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: string };
//
// Resultado<number> e Resultado<string> são tipos diferentes, gerados do mesmo molde.
//
// Mecanismo: inferência
//
// Em funções, o parâmetro de tipo pode ser inferido pelo compilador a partir dos argumentos:
//
function primeiro<T>(xs: readonly T[]): T | undefined {
  return xs[0];
}

const a = primeiro([1, 2, 3]);      // T inferido: number
const b = primeiro(["x", "y"]);     // T inferido: string
//
// A relação importa: T liga a entrada à saída. Sem generic, any perde a relação e unknown exige narrowing.
//
// Constraints: limitar o que T pode ser
//
function comprimento<T extends { length: number }>(x: T): number {
  return x.length;
}

comprimento("abc");        // ok
comprimento([1, 2]);       // ok
// comprimento(42);    // erro: number nao tem length
//
// extends aqui significa "é atribuível a", não herança de classe. Dentro da função, somente os membros garantidos pela constraint podem ser usados.
//
// Armadilha: generic que não relaciona nada
//
function logar<T>(x: T): void {   // T só aparece uma vez
  console.log(x);
}
//
// Um parâmetro de tipo usado uma única vez não relaciona entrada e saída e, quase sempre, unknown faria o mesmo. Regra prática: todo T deve aparecer pelo menos duas vezes (por exemplo, no parâmetro e no retorno), senão provavelmente é desnecessário.
//
// O uso real: mapComLimite
//
// A assinatura representa o worker pool:
//
async function mapComLimite<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error("O limite deve ser um inteiro positivo.");
  }

  const resultados: R[] = new Array(itens.length);
  for (let inicio = 0; inicio < itens.length; inicio += limite) {
    const lote = itens.slice(inicio, inicio + limite);
    const valores = await Promise.all(lote.map(fn));
    resultados.splice(inicio, valores.length, ...valores);
  }
  return resultados;
}
//
// Cada letra tem um papel: T liga os itens ao parâmetro de fn; R liga o retorno de fn ao tipo do array de resultados. Uma fn que devolve Promise<string> produz um resultado string[] por inferência. Esse é o efeito de um generic bem usado: precisão do tipo concreto com reutilização do código genérico.
//
// 2. keyof, indexed access e mapped types
//
// São as ferramentas para derivar tipos de outros, em vez de duplicá-los (o mesmo princípio de "o schema é a fonte da verdade, o tipo é derivado").
//
type Usuario = { id: number; nome: string; email: string };

type Chave = keyof Usuario;           // "id" | "nome" | "email"
type TipoDoNome = Usuario["nome"];    // string
//
// Mapped type: cria um tipo transformando cada chave:
//
type Somenteleitura<T> = { readonly [K in keyof T]: T[K] };
type Opcional<T>       = { [K in keyof T]?: T[K] };
//
// Os utilitários nativos (Partial, Readonly, Pick, Omit, Record) são mapped types.
//
// Um uso que elimina um bug real
//
function lerCampo<T, K extends keyof T>(obj: T, chave: K): T[K] {
  return obj[chave];
}

const u: Usuario = { id: 1, nome: "Ana", email: "a@x.com" };
const n = lerCampo(u, "nome");   // tipo: string
// lerCampo(u, "telefone");      // erro: "telefone" nao e chave de Usuario
//
// T aparece no objeto e K restringe a chave a keyof T; por isso, o tipo de retorno T[K] muda conforme a chave. Sem generics, a relação seria perdida em any.
//
// 3. Conditional types
//
// Fundamento
//
// Um tipo que decide com base em outro tipo, como um if no nível dos tipos:
//
type EhString<T> = T extends string ? true : false;

type AString = EhString<"x">;      // true
type BNumber = EhString<number>;   // false
//
// A forma é T extends U ? X : Y, onde extends pergunta: "T é atribuível a U?"
//
// Distribuição sobre uniões (o comportamento surpreendente)
//
// Quando T é um parâmetro de tipo nu e recebe uma união, o conditional distribui: é aplicado a cada membro separadamente, e os resultados são unidos.
//
type ParaArray<T> = T extends unknown ? T[] : never;

type RArray = ParaArray<string | number>;
// string[] | number[]    (e NÃO (string | number)[])
//
// É por isso que utilitários como Exclude funcionam:
//
type Exclude<T, U> = T extends U ? never : T;

type X = Exclude<"a" | "b" | "c", "a">;   // "b" | "c"
//
// Cada membro é testado; os que casam viram never, e never some da união (é o elemento neutro, o conjunto vazio, como vimos no default exaustivo).
//
// Para desligar a distribuição, envolva em tupla: [T] extends [U] ? ... : .... Isso importa porque a distribuição é automática e silenciosa: o mesmo tipo escrito com e sem os colchetes dá resultados diferentes, e é uma fonte comum de confusão.
//
// Armadilha: never como entrada
//
type EhStringNever<T> = T extends string ? true : false;
type RNever = EhStringNever<never>;    // never
//
// Distribuir sobre a união vazia resulta em never. Quando T é never, por exemplo após um Exclude que removeu tudo, o conditional desaparece em silêncio. Com [T] extends [string], o resultado seria true.
//
// 4. infer: extrair um tipo de dentro de outro
//
// Dentro da cláusula extends de um conditional, infer declara uma variável de tipo que o compilador preenche se o padrão casar:
//
type RetornoDe<F> = F extends (...args: never[]) => infer R ? R : never;

type R1 = RetornoDe<() => number>;            // number
type R2 = RetornoDe<(x: string) => boolean>;  // boolean
//
// A definição significa: se F é uma função, o tipo retornado é capturado em R; caso contrário, o resultado é never. Os utilitários ReturnType, Parameters e Awaited usam esse mecanismo.
//
// Um uso prático
//
type DesembrulharPromise<T> = T extends Promise<infer U> ? U : T;

type APromise = DesembrulharPromise<Promise<string>>;   // string
type BPromise = DesembrulharPromise<number>;            // number
//
// Na prática, para promessas use o Awaited<T> nativo, que também trata promessas aninhadas. O ponto aqui é entender o mecanismo, não reinventar.
//
// Quando a variável aparece em posições diferentes, o resultado depende de variância (seção 6): em posições covariantes, como retorno, as inferências viram união; em posições contravariantes, como parâmetro, viram interseção. O comportamento pode ser conferido na documentação do handbook.
//
// 5. Template literal types e tipos recursivos
//
// Template literal types
//
// Constroem tipos de string a partir de outros:
//
type Evento = "clique" | "foco";
type NomeDoHandler = `on${Capitalize<Evento>}`;   // "onClique" | "onFoco"
//
// Útil para modelar convenções de nomes, rotas e chaves de eventos, quando o conjunto é finito e conhecido.
//
// Tipos recursivos
//
type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [chave: string]: Json };
//
// Um tipo que se refere a si mesmo. É o jeito natural de modelar árvores e JSON. Armadilha real: tipos recursivos muito profundos podem estourar o limite de instanciação do compilador (erro "excessively deep"), e deixar o editor lento. Isso é custo de tempo de compilação, não de runtime, e é uma das razões para não abusar de type-level programming.
//
// 6. Variância: por que T[] aceita subtipos e uma função não
//
// Fundamento
//
// Se Gato é um subtipo de Animal, a pergunta é: um Caixa<Gato> pode ser usado onde se espera Caixa<Animal>? A resposta depende de como T é usado dentro do tipo.
//
// Covariante: a direção se mantém. Gato → Animal implica Caixa<Gato> → Caixa<Animal>. Ocorre quando T só sai (é lido, retornado).
// Contravariante: a direção se inverte. Gato → Animal implica Consumidor<Animal> → Consumidor<Gato>. Ocorre quando T só entra (parâmetro).
// Invariante: nenhuma direção vale. T entra e sai (lido e escrito).
// Bivariante: as duas direções são aceitas (o que o TypeScript faz com parâmetros de método, por conveniência histórica, e é uma fonte de inconsistência).
//
// Mecanismo: o exemplo que explica tudo
//
interface Animal { nome: string }
interface Gato extends Animal { miar(): void }

// Covariância: leitura
const gatosSomenteLeitura: Gato[] = [];
const animaisSomenteLeitura: readonly Animal[] = gatosSomenteLeitura;   // ok
//
// Tudo que é lido de uma lista de gatos também é um animal.
//
// Contravariância: função que consome
type Tratar<T> = (x: T) => void;

const tratarAnimal: Tratar<Animal> = (a) => console.log(a.nome);
const tratarGato: Tratar<Gato> = tratarAnimal;   // ok sob strictFunctionTypes
//
// Também faz sentido: uma função que sabe tratar qualquer animal serve onde se espera uma que trata gatos. O inverso não vale: uma função que exige miar() não aceita um animal qualquer.
//
// A armadilha: arrays mutáveis são covariantes no TypeScript (e isso é inseguro)
//
const gatosMutaveis: Gato[] = [{ nome: "Tom", miar() {} }];
const animaisMutaveis: Animal[] = gatosMutaveis;       // compila!

animaisMutaveis.push({ nome: "Rex" });         // compila: Rex nao tem miar()
// gatosMutaveis[1].miar();                    // produziria TypeError em runtime
//
// Um array mutável deveria ser invariante (leitura e escrita), mas o TypeScript o trata como covariante por ergonomia. É uma falha de soundness deliberada: o compilador aceita código que pode quebrar em runtime. A defesa prática é usar readonly Animal[] ou ReadonlyArray em operações somente de leitura, tornando a covariância legítima.
//
// Isso conecta com o fundamento 1: o tipo é uma promessa, e aqui o compilador a aceita com um furo conhecido. O tratamento de arrays e a opção strictFunctionTypes afetam funções, mas não métodos.
//
// Anotações de variância
//
// Em versões recentes é possível declarar a variância explicitamente com in e out em parâmetros de tipo (interface Caixa<out T>), útil para documentar a intenção e acelerar a checagem. A versão mínima deve ser conferida na documentação oficial.
//
// 7. satisfies versus asserção
//
// Generics e inferência permitem fechar o ponto deixado em aberto:
//
const config = {
  porta: 8080,
  debug: false,
} satisfies { porta: number; debug: boolean };
//
// as T: afirma, muda o tipo da expressão para T. Pode mentir.
// satisfies T: verifica se a expressão é compatível com T, e preserva o tipo inferido mais preciso. Aqui config.porta continua sendo number (e em literais mais específicos manteria o literal), e erros de digitação nas chaves são pegos.
//
// satisfies é adequado para literais de configuração que precisam de validação sem perder a inferência. A construção não valida dados externos: JSON.parse retorna any, e any satisfaz tudo. Esse é o limite discutido no fundamento 1.
//
export {};
