const listAuditoria = [];
let saldo = 100;

async function registrarAuditoria(valor:number):Promise<void>{
    listAuditoria.push(valor);
}
async function sacar(valor: number): Promise<void> {
  if (saldo >= valor) {
    saldo -= valor;
    try{
      await registrarAuditoria(valor);
    }catch(e){
      saldo += valor;
      throw e;
    }
  }
}
/*
  se as operações são independentes e todas devem ser contabilizadas, allSettled; 
  se são partes de uma unidade que só vale inteira, all sozinho não basta, 
  porque não desfaz as que já tiveram sucesso.
*/
await Promise.all([sacar(80), sacar(80)]);
console.log(saldo);
saldo = 100;
const rs = await Promise.allSettled([sacar(50), sacar(50)]);
console.log(saldo, rs.map(r => r.status));


const resultadosAll = await Promise.all([
  Promise.reject(new Error("x")),
  Promise.reject(new Error("y")),
]);

/*const resultadosAllSettled = await Promise.allSettled([
  Promise.reject(new Error("x")),
  Promise.reject(new Error("y")),
]);*/

console.log(resultadosAll);

//console.log(resultadosAllSettled);

console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");

export {};