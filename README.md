# Fundamentos de TypeScript e JavaScript

Este repositório reúne estudos sobre sete responsabilidades importantes ao
escrever código TypeScript:

1. validar dados que atravessam a fronteira da aplicação;
2. representar apenas estados válidos no modelo;
3. controlar o comportamento de operações assíncronas;
4. tornar repetições seguras diante de falhas parciais;
5. preservar invariantes por meio de contratos explícitos;
6. verificar propriedades do sistema em diversos cenários;
7. expressar relações avançadas entre tipos.

Os arquivos não tratam o TypeScript como uma garantia absoluta. A ideia
central é combinar o que o compilador consegue verificar com validações e
decisões explícitas em runtime.

## Fundamento 1 — tipos estáticos e dados externos

O TypeScript verifica o código durante a compilação, mas não verifica
automaticamente os dados recebidos em runtime. Respostas HTTP, banco de
dados, filas, variáveis de ambiente, `localStorage` e resultados de
`JSON.parse` devem ser considerados dados não confiáveis.

O fluxo seguro apresentado em [fundamento1.ts](./fundamento1.ts) é:

1. receber o valor como `unknown`;
2. verificar a sintaxe quando necessário;
3. validar a estrutura e as regras do valor;
4. só então estreitar o tipo e permitir seu uso.

O schema do Zod funciona como uma regra executável de validação. `z.infer`
apenas deriva um tipo para o compilador: ele não valida valores por conta
própria. Por isso, o schema é a fronteira entre um dado externo e um dado que
a aplicação pode tratar como válido.

Também é importante separar falhas diferentes:

- `fetch` pode falhar por problemas de rede, mas respostas HTTP 4xx e 5xx
  precisam ser verificadas explicitamente com `response.ok`;
- `JSON.parse` verifica somente se o texto é JSON válido, não se o conteúdo
  possui o formato esperado;
- `parse` lança uma exceção para dados inválidos, enquanto `safeParse`
  comunica o resultado por meio de `success`, oferecendo os dados validados
  somente no caso de sucesso;
- valores vindos diretamente de `process.env` são strings, portanto podem
  precisar de transformação antes de serem usados como booleanos ou números.

## Fundamento 2 — estados inválidos irrepresentáveis

Em [fundamento2.ts](./fundamento2.ts), o problema inicial é um modelo de
pagamento com várias propriedades opcionais. Esse formato permite combinações
incoerentes, como um pagamento pendente com ID de transação, ou um pagamento
cancelado com data de pagamento.

A união discriminada corrige o modelo ao usar `status` como discriminante:

- `pendente` não possui dados de pagamento ou cancelamento;
- `pago` exige a data e o ID da transação;
- `cancelado` exige o motivo do cancelamento.

Assim, as combinações inválidas deixam de ser descritas pelo tipo. O
compilador também pode verificar se todos os estados são tratados. A
atribuição do estado restante a `never` funciona como uma verificação
exaustiva: se uma nova variante for adicionada e esquecida no `switch`, o
erro aparece no ponto em que o tratamento ficou incompleto.

O tipo `Resultado<T>` aplica o mesmo princípio a sucesso e falha. Em vez de
um objeto parcialmente preenchido, ele representa explicitamente uma das duas
possibilidades:

- `{ ok: true, valor: T }`;
- `{ ok: false, erro: string }`.

O campo `ok` permite que o compilador estreite o tipo dentro de cada ramo.

O exemplo de `DataValida` mostra uma garantia diferente. A marca nominal
ajuda o compilador a distinguir uma data que passou por uma função de
validação de uma `Date` comum. Essa marca não valida nada sozinha, não torna o
objeto imutável e só é usada depois da verificação em runtime.

Além disso, a data é clonada antes de ser marcada. Dessa forma, alterações
posteriores no objeto original não invalidam o valor que foi aceito como
válido.

## Fundamento 3 — execução assíncrona e concorrência

Os arquivos [fundamento3_parte1.ts](./fundamento3_parte1.ts) e
[fundamento3_parte2.ts](./fundamento3_parte2.ts) exploram o event loop e os
limites de operações assíncronas.

### Event loop e `await`

JavaScript executa uma tarefa por vez no thread principal. `async/await` não
cria paralelismo automaticamente: ao encontrar `await`, a função é suspensa e
o controle volta ao event loop enquanto a operação espera rede, disco ou um
timer.

O trecho síncrono antes do primeiro `await` não é interrompido pelo event
loop. Por isso, no exemplo de saque, a verificação do saldo e a subtração
acontecem juntas. Depois disso, a auditoria pode falhar; nesse caso, o valor
é reposto antes de o erro ser propagado. Esse é um rollback local, não uma
transação geral.

### `Promise.all` e `Promise.allSettled`

As duas funções agregam promessas, mas expressam intenções diferentes:

- `Promise.all` espera que todas tenham sucesso e rejeita quando uma falha;
  ele não desfaz efeitos que já aconteceram;
- `Promise.allSettled` espera todas terminarem e informa individualmente quais
  foram concluídas ou rejeitadas.

Portanto, `allSettled` é adequado quando cada operação deve ser observada
mesmo que outras falhem. Quando várias operações formam uma unidade que só
vale inteira, `Promise.all` sozinho não fornece rollback.

A ordem entre tarefas também importa. O código síncrono da tarefa atual é
executado primeiro; microtasks de promessas são processadas antes de
callbacks de timers. No exemplo, essa regra produz a ordem `1, 4, 3, 2`.

### Cancelamento cooperativo

Uma Promise não cancela a operação que está por trás dela. Depois que a
operação começou, ela pode apenas resolver ou rejeitar. O cancelamento é
cooperativo: quem inicia a operação fornece um `AbortSignal`, e quem executa
precisa observá-lo.

No exemplo de requisição, `AbortController` produz o sinal e `fetch` o
observa. Uma interrupção gera um `AbortError`, que deve ser distinguido de
outros erros. Cancelar uma requisição localmente também não desfaz
necessariamente um efeito que já tenha sido recebido pelo servidor remoto.

Cancelamento e erro HTTP são conceitos separados: mesmo uma resposta 4xx ou
5xx continua sendo uma resposta que precisa ser verificada com `response.ok`.

### Limite de concorrência

`Promise.all` aguarda as promessas, mas não limita quantas operações são
iniciadas. Um `map` sobre milhares de itens pode iniciar milhares de chamadas
antes de o `Promise.all` começar a aguardar o conjunto. Isso pode provocar
respostas `429`, esgotamento de sockets ou descritores de arquivo e aumento
de memória.

A função `mapComLimite` resolve esse problema mantendo um número definido de
workers. Cada worker reserva um índice de forma síncrona e, enquanto espera
seu item, libera o event loop para os demais workers. Assim, o limite
controla o início das operações, não apenas a forma de esperar por elas.

Quando um worker falha, novos itens deixam de ser iniciados, mas operações
que já começaram não são canceladas automaticamente. Para obter esse
comportamento, a função processadora também precisaria receber e observar um
`AbortSignal`. A biblioteca `p-limit`, mostrada como alternativa no arquivo,
segue o mesmo princípio: ela limita o início das tarefas, enquanto
`Promise.all` apenas aguarda seus resultados.

## Fundamento 4 — idempotência e falhas parciais

O [fundamento4.ts](./fundamento4.ts) trata de uma situação comum em operações
de rede: o cliente não consegue saber se um timeout aconteceu antes de a
operação chegar ao servidor, depois de ela ser processada ou enquanto a
resposta era perdida. Para o cliente, esses cenários parecem iguais.

Uma operação é idempotente quando executá-la uma ou várias vezes produz o
mesmo estado final. Definir o estoque como `20` é idempotente; subtrair `80`
não é, porque cada repetição altera o estado novamente. Idempotência não
significa ausência de efeitos observáveis, mas sim que repetições não
acrescentam efeitos ao resultado da primeira execução.

Por isso, um retry ingênuo em uma operação não idempotente, como uma cobrança,
pode criar duplicidades. A solução apresentada é uma chave de idempotência:

- o cliente cria uma chave por intenção, não por tentativa;
- todas as tentativas enviam a mesma chave;
- o servidor guarda a chave e o resultado da primeira execução;
- uma repetição com a mesma chave e o mesmo corpo recebe o resultado já
  registrado, sem executar a operação novamente;
- a mesma chave com um corpo diferente deve ser rejeitada explicitamente,
  pois indica reuso incorreto da intenção.

A verificação e o registro da chave precisam ser atômicos. Se duas requisições
consultarem ao mesmo tempo se a chave existe e ambas receberem “não”, as duas
podem executar a operação. Uma restrição `UNIQUE` no banco ou uma operação
atômica de criação, como “criar se não existir”, impede essa corrida.

Reservar a chave antes do efeito introduz o problema da chave órfã: o servidor
pode cair depois da reserva e antes de concluir a operação. Uma reserva sem
resultado pode representar tanto uma execução ainda em andamento quanto uma
execução abandonada. O arquivo apresenta duas formas de tratar esse estado:

- **lease:** a reserva expira depois de um prazo e pode ser retomada; o prazo
  precisa equilibrar operações lentas e tempo de recuperação;
- **mesma transação:** o efeito e o registro do resultado são confirmados
  juntos, evitando um estado intermediário visível.

Uma transação só cobre efeitos que pertencem ao mesmo banco. Para efeitos
externos, como um provedor de pagamentos, a chave também precisa ser
propagada ao provedor, podendo ser necessário combinar retry, lease e
reconciliação.

## Fundamento 5 — invariantes e contratos explícitos

O [fundamento5.ts](./fundamento5.ts) organiza uma operação em torno de
garantias que devem permanecer verdadeiras. Uma **invariante** vale em todo
estado observável, como “o saldo nunca é negativo”. Uma **pré-condição** deve
ser satisfeita antes da operação, e uma **pós-condição** descreve o que a
função garante depois de terminar.

A classe `Conta` mantém o saldo privado para impedir alterações que não passem
pelas regras do próprio domínio. O depósito e o saque validam que o valor é
finito e positivo; o saque também verifica se há saldo suficiente. Essas
validações preservam a invariante de que o saldo não fica negativo.

O resultado usa uma união discriminada com sucesso ou falha. Em vez de
depender de exceções ou de um estado parcialmente preenchido, a operação
retorna um valor explícito:

- sucesso com o saldo atual;
- erro conhecido de valor inválido, saldo insuficiente ou falha no registro.

No saque assíncrono, a redução do saldo é provisória até o registro terminar.
Se o registro falhar, uma compensação local repõe o valor e o erro é
representado como `falha_no_registro`. Essa compensação não desfaz
necessariamente efeitos externos que o registro já tenha produzido.

O tratamento dos erros conhecidos também é exaustivo. O uso de `never` faz o
compilador apontar o `switch` caso uma nova variante seja adicionada e não
seja tratada. Assim, o contrato do domínio evolui junto com os pontos que
dependem dele.

## Fundamento 6 — testes baseados em propriedades

O [fundamento6.ts](./fundamento6.ts) compara duas formas de testar. Um teste
por exemplos verifica uma entrada específica e uma saída esperada. Um teste
baseado em propriedades descreve uma afirmação que deve valer para qualquer
entrada dentro de um domínio, deixando a ferramenta procurar um
contraexemplo.

Esse tipo de teste é formado por quatro partes:

- **gerador:** produz entradas, simples ou compostas;
- **propriedade:** afirmação que retorna verdadeiro, falso ou lança uma
  exceção;
- **executor:** aplica a propriedade a muitas entradas;
- **shrinking:** reduz uma entrada que falhou ao menor caso que continua
  reproduzindo o erro.

O shrinking transforma uma falha difícil de entender, como uma sequência
longa de operações, em um caso mínimo e diagnosticável. A seed registrada
permite reproduzir a mesma sequência de entradas e investigar a falha com
precisão.

As propriedades não precisam ser exemplos disfarçados. O arquivo apresenta
alguns padrões úteis:

- invariantes que devem permanecer verdadeiras depois de cada operação;
- round-trip, em que serializar e desserializar devolve o valor original;
- idempotência, em que aplicar uma normalização duas vezes equivale a
  aplicá-la uma vez;
- comparação com um modelo simples e independente;
- relações entre entradas e saídas, como monotonicidade ou independência da
  ordem;
- propriedades de “não quebra”, verificando que entradas válidas não geram
  exceções inesperadas.

O exemplo da `Conta` evidencia por que o domínio das entradas importa. Uma
validação que rejeita apenas valores menores que zero deixa passar `NaN`,
porque `NaN < 0` é falso. O teste baseado em propriedades encontra esse
contraexemplo e leva a correção à validação de valores finitos.

Quando a regra precisa valer durante uma sequência, a propriedade deve
verificar a invariante depois de cada comando, e não somente no estado final.
O exemplo também mantém um modelo trivial de saldo ao lado da implementação.
Comparar ambos torna possível detectar divergências sem depender dos detalhes
internos da classe. Esse estilo é conhecido como teste de modelo.

## Fundamento 7 — sistema de tipos avançado

O [fundamento7.ts](./fundamento7.ts) apresenta recursos para expressar
relações entre tipos sem duplicar declarações nem perder precisão.

### Generics e tipos derivados

Um generic recebe um tipo e devolve outro, mantendo uma relação entre entrada
e saída. Em `primeiro<T>`, o tipo do item retornado é inferido a partir da
lista. Em `mapComLimite<T, R>`, `T` relaciona os itens à função processadora
e `R` relaciona o retorno da função ao array final.

Constraints, como `T extends { length: number }`, limitam o que pode ser
aceito sem significar herança de classe. Dentro da função, somente os membros
garantidos pela constraint podem ser usados. Um parâmetro genérico usado uma
única vez, sem relacionar entradas e saídas, geralmente não acrescenta
informação e pode ser substituído por `unknown`.

`keyof`, indexed access e mapped types derivam novos tipos de outros tipos:

- `keyof` produz a união das chaves possíveis;
- `T[K]` obtém o tipo associado a uma chave;
- mapped types transformam cada propriedade, como em versões somente leitura
  ou opcionais.

Essa combinação permite que `lerCampo` aceite apenas chaves existentes e
retorne o tipo correspondente ao campo escolhido.

### Conditional types e `infer`

Conditional types funcionam como decisões no nível dos tipos, na forma
`T extends U ? X : Y`. Quando recebem uma união, podem distribuir a decisão
por cada membro; esse comportamento explica utilitários como `Exclude`.
Envolver o tipo em uma tupla desativa essa distribuição quando necessário.
Também é importante lembrar que `never` como entrada pode fazer um conditional
desaparecer silenciosamente por causa dessa distribuição.

`infer` permite extrair uma parte de um tipo dentro de uma condição, como o
retorno de uma função ou o valor contido em uma `Promise`. Utilitários nativos
como `ReturnType`, `Parameters` e `Awaited` usam esse mecanismo. O exemplo
também destaca que, na prática, é preferível usar `Awaited<T>` para promessas
em vez de recriar o utilitário.

### Template literals e tipos recursivos

Template literal types constroem uniões de strings a partir de outras, sendo
úteis para convenções finitas de nomes, eventos e rotas. Tipos recursivos
modelam estruturas como árvores e JSON, mas tipos muito profundos podem
exceder o limite de instanciação do compilador e tornar o editor lento. Esse
é um custo de compilação, não de runtime.

### Variância

Variância descreve como um tipo genérico se comporta quando seu parâmetro é
substituído por um subtipo:

- **covariância:** o tipo é produzido ou lido, e a direção é preservada;
- **contravariância:** o tipo é consumido como parâmetro, e a direção é
  invertida;
- **invariância:** o tipo é lido e escrito, portanto nenhuma substituição é
  segura;
- **bivariância:** ambas as direções são aceitas, uma conveniência histórica
  que pode reduzir a segurança.

O exemplo mostra que uma função que trata qualquer `Animal` pode ser usada
onde se espera uma função que trata `Gato`, mas o contrário não é válido.
Também mostra a brecha de soundness dos arrays mutáveis: o TypeScript permite
tratar `Gato[]` como `Animal[]`, inserir um animal que não mia e provocar erro
em runtime. Para operações somente de leitura, `readonly` ou
`ReadonlyArray` torna a covariância segura. Anotações explícitas `in` e `out`
podem documentar a intenção de variância quando suportadas pela versão do
TypeScript.

### `satisfies` e asserções

Uma asserção `as T` força o compilador a aceitar a expressão como `T` e pode
mascarar um tipo incorreto. `satisfies T` verifica a compatibilidade com `T`,
mas preserva o tipo inferido mais preciso da expressão. Por isso, é adequado
para literais de configuração: erros de propriedades são encontrados sem
perder a inferência.

`satisfies` continua sendo uma verificação de compilação, não uma validação de
runtime. Um valor vindo de `JSON.parse` ou de outra fronteira externa precisa
passar pelo processo de validação apresentado no fundamento 1.

## Relação entre os fundamentos

Os sete fundamentos se complementam:

- **dados externos** precisam ser validados antes de receberem um tipo
  confiável;
- **dados internos** devem ser modelados para que combinações inválidas não
  sejam representadas;
- **operações assíncronas** precisam explicitar falhas, cancelamento,
  concorrência e possíveis efeitos parciais;
- **operações repetíveis** precisam de idempotência quando retries podem
  ocorrer;
- **regras de domínio** precisam de invariantes, pré-condições e
  pós-condições explícitas;
- **propriedades** ampliam a cobertura dos testes e ajudam a encontrar
  contraexemplos mínimos;
- **tipos avançados** mantêm relações e restrições expressas no compilador,
  sem substituir a validação em runtime.

Em conjunto, eles formam uma abordagem de confiabilidade: validar na entrada,
restringir os estados durante o processamento, controlar os efeitos das
operações ao longo do tempo, testar invariantes em muitos cenários e tornar
as relações e garantias do domínio verificáveis.
