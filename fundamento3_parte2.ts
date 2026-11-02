/**
 * O modelo de execução assíncrono (event loop, concorrência, race conditions).
 */

/*
//Cancelamento

async function buscar(url: string, signal: AbortSignal): Promise<unknown> {
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

const controller = new AbortController();
setTimeout(() => controller.abort(), 2000);

try {
  await buscar("https://api.exemplo.com/dados", controller.signal);
} catch (e) {
  if (e instanceof Error && e.name === "AbortError") {
    // cancelado por nós: não é falha da API
  } else {
    throw e;
  }
}
*/
//Limite de concorrência

async function mapComLimite<T, R>(itens: readonly T[],limite: number,fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximo = 0;
  let falhou = false;  
  async function worker(): Promise<void> {
    while (!falhou) {
      const i = proximo++;          // síncrono: atômico entre fatias
      if (i >= itens.length) return;
      try {
        resultados[i] = await fn(itens[i]);
      } catch (error) {
        falhou = true;
        throw error;
      }
    }
  }

  await Promise.all(Array.from({ length: limite }, worker));
  return resultados;
}

async function convert(i: number):Promise<String>{
    return Promise.resolve(`Number: ${i}`)
}

const res = await mapComLimite<number,String>([1,2,3,4,5],2,convert)

for (const element of res) {
    console.log(element);
}
/*
//Utilizando a biblioteca p-limit
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