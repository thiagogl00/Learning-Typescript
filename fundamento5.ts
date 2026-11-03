/**
 * Invariantes e contratos explícitos.
 *
 * Uma invariante é algo que deve ser verdadeiro em todo estado observável do
 * sistema, por exemplo “saldo nunca negativo” ou “pedido pago tem idTransacao”.
 * Uma pré-condição é o que deve ser verificado antes da operação; uma
 * pós-condição é o que a função garante ao terminar.
 */

// Result<T> torna explícitas as duas saídas possíveis: sucesso com valor ou
// falha com um erro conhecido. A propriedade ok permite o narrowing.
type Erro = "valor_invalido" | "saldo_insuficiente" | "falha_no_registro";
type Result<T> = { ok: true, saldoAtual: T } | { ok: false, erro: Erro };

async function registrarLog(valor: number): Promise<void> {
    // Simula uma dependência assíncrona. Esta implementação sempre resolve;
    // o erro de registro continua previsto no contrato de Conta para uma
    // implementação real que possa falhar.
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`valor: ${valor}`);
            resolve();
        }, 1000);
    });
}

class Conta {
    // O estado privado só pode ser alterado pelos métodos que aplicam os
    // contratos da conta.
  #saldo = 0;

    // Pré-condição: o depósito deve ser um número finito e positivo.
    // Pós-condição de sucesso: o saldo aumenta exatamente v.
  depositar(v: number): Result<number> {
    if(!Number.isFinite(v) || v <= 0){
        return { ok: false, erro: "valor_invalido" }; 
    }
    this.#saldo += v;
    return { ok: true, saldoAtual: this.#saldo };
  }
    /* Versão síncrona do saque, sem a etapa de registro assíncrono.
    sacar(v: number): Result<number> {
    if(!Number.isFinite(v) || v <= 0){
        return { ok: false, erro: "valor_invalido" }; 
    }else if(v>this.#saldo){
        return { ok: false, erro: "saldo_insuficiente" };   
    }
    this.#saldo -= v; 
    return { ok: true, saldoAtual: this.#saldo };
  }*/
  async sacar(v: number): Promise<Result<number>> {
        // As validações preservam a invariante de que o saldo não fica negativo.
    if (!Number.isFinite(v) || v <= 0)
         return { ok: false, erro: "valor_invalido" };
    if (v > this.#saldo) 
        return { ok: false, erro: "saldo_insuficiente" };

    // A subtração é provisória até o log terminar com sucesso.
    this.#saldo -= v;
    try{
        await registrarLog(v);
    } catch(e){
        // Compensação local: desfaz o saque se o registro falhar. Isso não
        // desfaz necessariamente efeitos externos já produzidos pelo log.
        this.#saldo += v;
        return { ok: false, erro: "falha_no_registro" };
    }

    // Pós-condição de sucesso: o log terminou e o saldo já foi reduzido.
    return { ok: true, saldoAtual: this.#saldo };
  }

  // Expõe apenas uma leitura do estado; o chamador não recebe acesso para
  // substituir diretamente o saldo privado.
  getSaldo(): number {
    return this.#saldo;
  }
}

const conta = new Conta();
const result = await conta.sacar(100);

// O discriminante ok separa o caminho de sucesso do caminho de erro.
if (result.ok) {
    console.log(`Saque realizado com sucesso. Saldo atual: ${result.saldoAtual}`);
} else {
    // O switch trata todos os erros conhecidos. Se uma nova variante for
    // adicionada ao tipo, o never abaixo fará o compilador apontar este ponto.
    switch (result.erro) {
        case 'valor_invalido':
            console.log("Erro: Valor inválido para saque.");
            break;
        case 'saldo_insuficiente':
            console.log("Erro: Saldo insuficiente para saque.");
            break;
        case 'falha_no_registro':
            console.log("Erro: Falha ao registrar o saque.");
            break;
        default:
            const _exastive: never = result.erro;
            throw new Error(`Erro desconhecido: ${_exastive}`);
    }
}

export { Conta };