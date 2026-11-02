/**
 * Idempotência e falhas parciais.
 */

/**
 * Uma operação é idempotente quando executá-la uma vez ou várias vezes produz o mesmo estado final. 
 * Exemplos: “defina o saldo como 20” é idempotente. “Subtraia 80 do saldo” não é: repetir subtrai de novo.
 * Isso importa porque, em rede, você nunca sabe se uma operação aconteceu. Se a resposta não chegou, 
 * a requisição pode ter falhado antes de chegar, ter sido processada e a resposta se perdido, ou ainda estar em andamento. 
 * Do seu lado, os três casos são idênticos: um timeout.
 */

// Versão ingênua: retry sem proteção
/*
async function cobrar(clienteId: string, valor: number): Promise<void> {
  await fetch("https://api.exemplo.com/cobrancas", {
    method: "POST",
    body: JSON.stringify({ clienteId, valor }),
  });
}

async function cobrarComRetry(clienteId: string, valor: number) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      return await cobrar(clienteId, valor);
    } catch {
      // tenta de novo
    }
  }
  throw new Error("falhou após 3 tentativas");
}
*/

/**
 * Quando há dúvida, a única ação segura para garantir que algo aconteça é tentar de novo (retry). 
 * Mas retry de uma operação não idempotente pode executá-la duas vezes. A solução padrão é a chave de idempotência: 
 * o cliente gera um identificador único por intenção (não por tentativa) e o envia junto. 
 * O servidor guarda as chaves já processadas e, ao ver uma repetida, devolve o resultado anterior em vez de executar de novo.
 * 
 * Um cliente envia POST com chave K, o servidor cria o pedido #88, e a resposta se perde. O cliente repete com K. 
 * O que o cliente deve receber? E se repetir com K mas com valor diferente no corpo?
 *  
Mesma chave, mesmo corpo: o cliente deve receber o resultado da primeira execução (o pedido #88), como se fosse a primeira vez.
A chave representa uma intenção. Corpo diferente com a mesma chave é, quase certamente, um bug do cliente (reuso indevido da chave, ou 
chave gerada fora do lugar certo). O comportamento correto é rejeitar com erro explícito, para o bug aparecer em vez de ser mascarado. 
Para detectar isso, o servidor guarda junto da chave um hash do corpo (ou o próprio corpo) e compara a cada repetição.
 * 
 * Duas requisições idênticas, com a mesma chave K, chegam ao servidor no mesmo instante, antes de qualquer uma ser registrada. 
 * Que bug clássico deste curso reaparece? Como o servidor deveria registrar a chave para evitá-lo?
 * 
Duas requisições com K chegam juntas. Ambas fazem “a chave K existe?” → não. Ambas executam a criação. Resultado: dois pedidos, 
e a proteção que deveria impedir duplicação falhou. A correção é tornar verificação e registro uma operação atômica, e não duas. 
Na prática, isso significa que o servidor reserva a chave primeiro, antes de executar, usando um mecanismo do armazenamento que garante
que só um vence:

 . Uma restrição de unicidade no banco (UNIQUE na coluna da chave): a segunda inserção falha, e o servidor sabe que perdeu a corrida.
 . Um comando atômico “criar se não existir” (por exemplo, SET ... NX no Redis).

Quem perde a corrida responde conforme o estado da chave: “em andamento” (ex.: 409) ou, se já terminou, o resultado guardado. 

E isso importa porque a idempotência só vale se a verificação da chave e o seu registro forem atômicos; do contrário, o mesmo defeito que
a chave deveria evitar (execução duplicada) reaparece na janela entre os dois passos.
 * 
 */

/**
 * Chave órfã
 * 
 * Com a chave reservada antes de executar, o servidor cai depois de reservar e antes de criar o pedido. 
 * O cliente repete com K. O que o servidor vê, e qual problema novo surge?
 * 
Linha do tempo:

O cliente envia POST com a chave K.
O servidor reserva K (estado: “em andamento”).
O servidor cai, antes de criar o pedido.
O cliente dá timeout e repete com K.
O servidor reinicia e encontra K registrada como “em andamento”, sem resultado associado.

Esse é o problema novo: uma chave órfã. O servidor não sabe distinguir dois casos:

“Outra requisição ainda está processando” (então o certo é responder “em andamento”).
“A requisição que reservou morreu” (então o certo é permitir que a repetição execute).

Do lado de fora os dois estados são idênticos: chave reservada, sem resultado. Se o servidor responder “em andamento” para sempre, 
o cliente fica preso: todo retry falha, e a operação nunca se completa. A proteção contra duplicação virou bloqueio permanente.

Há duas técnicas, e elas se combinam:

A. Expiração da reserva (lease). A reserva carrega um prazo (por exemplo, 30 segundos). Se o prazo passou sem resultado, 
o servidor assume que quem reservou morreu e permite que uma nova requisição tome a chave. O trade-off: o prazo precisa ser maior que 
o tempo normal da operação. Se for curto demais, uma operação lenta (ainda viva) pode ser executada de novo por outra requisição, 
e você volta à duplicação. Se for longo demais, o cliente espera muito depois de uma queda.

B. Chave e efeito na mesma transação. Se a criação do pedido e o registro do resultado da chave acontecem na mesma transação de banco,
existem só dois estados possíveis: ambos aconteceram ou nenhum aconteceu. Se o servidor cai no meio, a transação é desfeita, 
a chave não consta como concluída e a repetição executa normalmente. A janela da chave órfã desaparece, porque não existe estado 
intermediário visível.

Isso só funciona quando o efeito e a chave vivem no mesmo banco. Se o efeito é externo (uma chamada a um provedor de pagamento), 
a transação não o alcança, e voltamos a precisar de lease e de idempotência no próprio provedor (propagando a chave adiante).

Isso importa porque a idempotência exige que o servidor decida o que fazer com estado intermediário, e a forma mais segura de decidir 
é não permitir que ele exista (transação) ou dar a ele um prazo de validade (lease).
 */

// Versão com chave de idempotência
async function cobrar(clienteId: string, valor: number, chave: string) {
  await fetch("https://api.exemplo.com/cobrancas", {
    method: "POST",
    headers: { "Idempotency-Key": chave },
    body: JSON.stringify({ clienteId, valor }),
  });
}

async function cobrarComRetry(clienteId: string, valor: number) {
  const chave = crypto.randomUUID(); // UMA vez, fora do laço
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      return await cobrar(clienteId, valor, chave);
    } catch {
      // tenta de novo, com a MESMA chave
    }
  }
  throw new Error("falhou após 3 tentativas");
}

// --------------------------------------------------------------------------

let estoque = 10;

//depende de um estado anterior
function reservar(qtd: number): void {
  estoque -= qtd;
}

//depende do argumento
function definirEstoque(valor: number): void {
  estoque = valor;
}
