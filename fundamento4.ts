/**
 * Idempotência e falhas parciais.
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
