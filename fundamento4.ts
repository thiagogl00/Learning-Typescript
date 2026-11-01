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

export {};