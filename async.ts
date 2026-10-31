const listAuditoria = [];
let saldo = 100;

async function registrarAuditoria(valor:number):Promise<void>{
    listAuditoria.push(valor);
}
async function sacar(valor: number): Promise<void> {
  if (saldo >= valor) {
    await registrarAuditoria(valor);
    saldo -= valor;
  }
}

await Promise.all([sacar(80), sacar(80)]);
console.log(saldo);

console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");