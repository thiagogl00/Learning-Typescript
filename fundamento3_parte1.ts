/**
 * O modelo de execução assíncrono (event loop, concorrência, race conditions).
 */

// JavaScript executa uma tarefa por vez no thread principal. async/await não
// cria paralelismo por si só: await suspende a função e devolve o controle ao
// event loop enquanto a operação espera rede, disco ou um timer.
const listAuditoria = [];
let saldo = 100;

// A função é assíncrona porque representa uma operação que poderia envolver
// uma espera externa, embora esta implementação apenas altere a lista local.
async function registrarAuditoria(valor:number):Promise<void>{
    listAuditoria.push(valor);
}
async function sacar(valor: number): Promise<void> {
  // O teste e a subtração acontecem antes do primeiro await. Como o event loop
  // não interrompe esse trecho síncrono, as duas chamadas atuais não disputam
  // o saldo nessa seção.
  if (saldo >= valor) {
    saldo -= valor;
    try{
      await registrarAuditoria(valor);
    }catch(e){
      // Se a auditoria falhar depois da subtração, desfaz o efeito local antes
      // de propagar o erro para quem chamou a função.
      saldo += valor;
      throw e;
    }
  }
}
/*
  Se as operações são independentes e todas devem ser contabilizadas, use
  allSettled. Se são partes de uma unidade que só vale inteira, all sozinho
  não basta, porque não desfaz as que já tiveram sucesso.
*/
// Promise.all aguarda o conjunto quando tudo funciona, mas rejeita quando uma
// promessa falha. Ele não desfaz efeitos que já ocorreram.
await Promise.all([sacar(80), sacar(80)]);
console.log(saldo);
saldo = 100;

// Promise.allSettled aguarda todas as promessas e informa o resultado de cada
// uma, permitindo observar sucessos e falhas individualmente.
const rs = await Promise.allSettled([sacar(50), sacar(50)]);
console.log(saldo, rs.map(r => r.status));

// Uma rejeição de Promise.all precisa ser tratada para não interromper o
// restante do arquivo antes dos exemplos seguintes.
try {
  const resultadosAll = await Promise.all([
    Promise.reject(new Error("x")),
    Promise.reject(new Error("y")),
  ]);
  console.log(resultadosAll);
} catch (error) {
  console.log("Promise.all rejeitou:", error);
}

/*const resultadosAllSettled = await Promise.allSettled([
  Promise.reject(new Error("x")),
  Promise.reject(new Error("y")),
]);*/

// O código normal da tarefa atual vem primeiro. A microtask de then roda antes
// do callback do timer: a ordem esperada destes quatro logs é 1, 4, 3, 2.
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");

export {};