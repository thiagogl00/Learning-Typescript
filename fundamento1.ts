/**
 * Tipos estáticos ≠ garantias em runtime.
 */

//Trate toda fronteira de confiança (HTTP, banco, filas, variáveis de ambiente, localStorage, JSON.parse) 
// como unknown e valide antes de estreitar o tipo.
import { z } from 'zod';

const UsuarioSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
});
type Usuario = z.infer<typeof UsuarioSchema>; // o tipo deriva do schema

async function buscarUsuario(id: number): Promise<Usuario> {
  const resp = await fetch(`https://api.exemplo.com/usuarios/${id}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return UsuarioSchema.parse(await resp.json()); // falha aqui, na fronteira
}

// ------------------------------------------------------------------------------
const ConfigSchema = z.object({
  porta: z.int().min(1024).max(65535).default(3000),
  debug: z.boolean().default(false)
  /* debug: z
    .enum(['true', 'false']).default('false')
    .transform((value) => value === 'true'), */
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
