/**
 * O modelo de execução assíncrono (event loop, concorrência, race conditions).
 */

// Uma Promise não cancela a operação subjacente. Depois que a operação começa,
// a promessa só pode resolver ou rejeitar. Cancelar é cooperação: quem inicia
// entrega um sinal, e quem executa precisa observá-lo e parar por conta própria.


//Cancelamento

async function buscar(url: string, signal: AbortSignal): Promise<unknown> {
  // fetch observa o sinal e rejeita com AbortError quando a requisição é
  // interrompida. Isso não desfaz necessariamente um efeito já recebido pelo
  // servidor remoto.
  const resp = await fetch(url, { signal });

  // Cancelamento e erro HTTP são situações diferentes: fetch não rejeita
  // automaticamente para respostas 4xx ou 5xx.
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

const controller = new AbortController();
// O controller produz o sinal que será observado por buscar.
setTimeout(() => controller.abort(), 2000);

try {
  await buscar("https://api.exemplo.com/dados", controller.signal);
} catch (e) {
  if (e instanceof Error && e.name === "AbortError") {
    // Cancelado por nós: não é, por si só, uma falha da API.
  } else {
    throw e;
  }
}

//Limite de concorrência

/**
 * O problema:
 * const ids = [ 10.000 ids ];
 * await Promise.all(ids.map((id) => buscarUsuario(id)));
 * 
 * map inicia todas as 10.000 chamadas imediatamente, antes de qualquer await do
 * all valer. Você abriu 10.000 operações simultâneas. Consequências possíveis:
 * o servidor remoto devolve 429, você esgota descritores de arquivo ou sockets,
 * e a memória sobe por manter tudo em voo.
 * O código é correto em lógica e falha sob volume.

  Isso importa porque Promise.all observa a concorrência, mas não a controla:
  ela é decidida por quem inicia as operações.
 */

async function mapComLimite<T, R>(itens: readonly T[],limite: number,fn: (item: T) => Promise<R>): Promise<R[]> {
  // Sem workers úteis, nenhum item poderia ser processado.
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error('limite deve ser um inteiro positivo');
  }

  const resultados: R[] = new Array(itens.length);
  let proximo = 0;
  let falhou = false;

  async function worker(): Promise<void> {
    while (!falhou) {
      // A leitura e o incremento são síncronos: outro worker não pode
      // interromper este trecho e reservar o mesmo índice.
      const i = proximo++;
      if (i >= itens.length) return;
      try {
        // O await libera o event loop. Enquanto este item espera, outros
        // workers podem processar seus próprios índices.
        resultados[i] = await fn(itens[i]);
      } catch (error) {
        // A falha impede novos itens, mas não cancela funções que já começaram.
        // Para cancelá-las, fn precisaria receber e observar um AbortSignal.
        falhou = true;
        throw error;
      }
    }
  }

  // Promise.all rejeita se um worker falhar; ele não desfaz efeitos de tarefas
  // já iniciadas e não transforma o processamento em uma transação.
  await Promise.all(Array.from({ length: limite }, worker));
  return resultados;
}

async function convert(i: number):Promise<string>{
    return Promise.resolve(`Number: ${i}`)
}

const res = await mapComLimite<number,string>([1,2,3,4,5],2,convert)

for (const element of res) {
    console.log(element);
}
/*
// Utilizando a biblioteca p-limit:
// ela também limita o início das operações; o Promise.all apenas aguarda seus
// resultados e não é o mecanismo que impõe o limite.
import pLimit from 'p-limit';

// Define o limite máximo de requisições simultâneas
const limit = pLimit(3);

const urls = [
  'https://exemplo.com',
  'https://exemplo.com',
  'https://exemplo.com',
  'https://exemplo.com',
  'https://exemplo.com'
];

// O limit() envolve a função assíncrona
const tasks = urls.map(url => {
  return limit(() => fetch(url).then(res => res.json()));
});

// Executa tudo. Mesmo com 5 URLs, apenas 3 rodarão ao mesmo tempo
const resultados = await Promise.all(tasks);
console.log(resultados);
*/
export {};