/**
 * Testes de invariantes (property-based testing)
 * 
 * Um teste baseado em exemplos diz: “para esta entrada, espero esta saída”. 
 * Um teste baseado em propriedades diz: “para qualquer entrada dentro deste domínio, 
 * esta afirmação vale”. A ferramenta gera centenas de entradas, tenta falsificar a afirmação e, 
 * ao achar um contraexemplo, encolhe (shrinking) até o menor caso que ainda falha.
 */

import fc from "fast-check";
import { Conta } from "./fundamento5";


// 1. O problema que o método resolve

// Um teste por exemplos tem esta forma:

const soma = (a: number, b: number): number => a + b;
const expect = (valor: number) => ({
  toBe: (esperado: number) => {
    if (valor !== esperado) throw new Error(`Esperado ${esperado}, recebido ${valor}`);
  },
});
const deepEqual = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
expect(soma(2, 3)).toBe(5);

// Esse teste demonstra apenas o comportamento para aquela entrada. Todo o resto do espaço de entradas fica sem verificação, e a escolha dos exemplos depende dos casos perigosos considerados na elaboração do teste. Bugs que chegam à produção podem estar em entradas não consideradas, como NaN, zero, lista vazia, valor enorme ou ordem estranha de operações.

// O teste por propriedades inverte a lógica: a propriedade descreve uma afirmação que deve valer para todas as entradas de um domínio, e a ferramenta procura um contraexemplo.

// 2. Os quatro componentes

// 1. Gerador (arbitrary): produz entradas aleatórias de um tipo. Pode ser simples (fc.integer()) ou composto (fc.array(fc.string())).
// 2. Propriedade: função da entrada que devolve verdadeiro ou falso (ou lança exceção).
// 3. Executor: roda a propriedade centenas de vezes com entradas diferentes.
// 4. Shrinking: quando encontra uma entrada que falha, a biblioteca a simplifica passo a passo (lista menor, número mais próximo de zero) até o menor exemplo que ainda falha. Sem esse processo, uma lista de 80 elementos seria incompreensível; com ele, o resultado pode ser reduzido a NaN.

// Além disso, a falha vem com uma seed, que reproduz exatamente a mesma sequência de entradas. Sem registrar a seed, uma falha encontrada uma vez pode nunca mais aparecer.

// Em TypeScript, a biblioteca mais usada é a fast-check. A API muda entre versões; nomes e opções devem ser conferidos na documentação da versão utilizada.

// 3. Como pensar: de onde vêm as propriedades

// A dificuldade real do método não é a ferramenta, é achar boas propriedades. Há alguns padrões que cobrem a maior parte dos casos.

// a) Invariantes. Algo que vale depois de qualquer operação. No exemplo de sequências, a invariante é saldo >= 0 e saldo finito.

// b) Round-trip (ida e volta). Duas operações inversas devolvem o original:

// parse(serialize(x)) deve ser igual a x
fc.assert(
  fc.property(fc.jsonValue(), (x) => {
    return deepEqual(JSON.parse(JSON.stringify(x)), x);
  })
);

// Útil em serialização, codificação, compressão, conversão de formatos. (A exata assinatura de jsonValue e as opções dependem da versão. Note também que JSON.stringify tem casos-limite, como undefined e -0; justamente o tipo de coisa que a propriedade pode revelar.)

// c) Idempotência da própria função. Aplicar duas vezes dá o mesmo que uma:

// normalizar(normalizar(x)) === normalizar(x)

// d) Comparação com um modelo simples (oráculo). Uma implementação rápida e complexa é comparada com outra ingênua e obviamente correta. A propriedade exige o mesmo resultado nas duas. Exemplo: mapComLimite pode ser comparado com Promise.all(xs.map(f)) quanto ao resultado, já que a diferença está no tempo e na concorrência.

// e) Relações entre entradas e saídas. Se a ordem da entrada não importa, ordenar(embaralhar(xs)) deve igualar ordenar(xs). Se aumentar o depósito nunca diminui o saldo, isso é uma relação (monotonicidade).

// f) Propriedades de "não quebra". A mais fraca e muitas vezes a mais útil para começar: para qualquer entrada, a função não lança exceção inesperada e devolve um valor do tipo certo. Essa propriedade revelou o caso de NaN.

// 4. O exemplo central: encontrando o NaN

// A Conta original validava apenas if (v < 0):

fc.assert(
  fc.property(fc.double(), (v) => {
    const c = new Conta();
    c.depositar(v);
    return Number.isFinite(c.getSaldo()) && c.getSaldo() >= 0;
  })
);

// Rastreio do que acontece:

// 1. O gerador inclui valores especiais de ponto flutuante, como NaN e Infinity. Os valores gerados por fc.double dependem da versão e das opções utilizadas.
// 2. Com v = NaN, NaN < 0 é false, a validação passa, e saldo += NaN torna o saldo NaN.
// 3. A propriedade devolve false.
// 4. O shrinking reduz o contraexemplo a NaN e a biblioteca imprime a seed.
// 5. Testando sequências de operações

// Invariantes valem em todo estado observável, e não só após uma chamada. Por isso, o gerador não deve produzir um valor, e sim uma sequência de comandos:

type CmdExemplo =
  | { tipo: "depositar"; v: number }
  | { tipo: "sacar"; v: number };

const cmdExemplo = fc.oneof(
  fc.record({ tipo: fc.constant("depositar" as const), v: fc.double() }),
  fc.record({ tipo: fc.constant("sacar" as const), v: fc.double() })
);

fc.assert(
  fc.asyncProperty(fc.array(cmdExemplo), async (cmds) => {
    const c = new Conta();
    for (const x of cmds) {
      if (x.tipo === "depositar") c.depositar(x.v);
      else await c.sacar(x.v);
      if (!(Number.isFinite(c.getSaldo()) && c.getSaldo() >= 0)) return false;
    }
    return true;
  })
);

// Dois detalhes importantes:

// A invariante é checada dentro do laço, depois de cada comando. Se ela fosse checada só no final, um estado inválido intermediário que depois "se curasse" passaria despercebido.
// O shrinking funciona também sobre a lista: uma sequência de 40 comandos que falha é reduzida à menor sequência que reproduz o erro, às vezes dois comandos. Isso transforma o diagnóstico: a história mínima do bug fica explícita.

// Esse estilo, em que o teste gera sequências de operações e compara com um modelo, é chamado de teste de modelo (model-based testing). A fast-check tem suporte dedicado a comandos e modelos; a API atual deve ser consultada na documentação da versão utilizada.

// 6. Um modelo para comparar

// Uma propriedade independente da implementação é manter um modelo trivial ao lado:

fc.assert(
  fc.asyncProperty(fc.array(cmdExemplo), async (cmds) => {
    const c = new Conta();
    let modelo = 0;                      // o modelo é só um número

    for (const x of cmds) {
      const r = x.tipo === "depositar" ? c.depositar(x.v) : await c.sacar(x.v);

      if (r.ok) {
        modelo += x.tipo === "depositar" ? x.v : -x.v;
      }
      if (c.getSaldo() !== modelo) return false;
    }
    return true;
  })
);
