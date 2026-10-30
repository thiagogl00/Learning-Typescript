
import { z } from 'zod';

const ConfigSchema = z.object({
  porta: z.int().min(1024).max(65535).default(3000),
  debug: z.boolean().default(false)
  });

//type Config = z.infer<typeof ConfigSchema>; 

function lerJson(texto: string):
  | { ok: true; valor: unknown }
  | { ok: false; erro: string } {
  try {
    return {
      ok: true,
      valor: JSON.parse(texto),
    };
  } catch (error) {
    return {
      ok: false,
      erro: `APP_CONFIG contém JSON inválido: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

const json = lerJson(process.env.APP_CONFIG ?? '{}');

if (!json.ok) {
  console.error(json.erro);
  process.exit(1);
}

const resultado = ConfigSchema.safeParse(json.valor);

if (!resultado.success) {
  const mensagens = resultado.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  console.error(`APP_CONFIG inválida:\n${mensagens}`);
  process.exit(1);
}

const data = resultado.data;

console.log(`Porta ${data.porta}, Debug: ${data.debug}`);
