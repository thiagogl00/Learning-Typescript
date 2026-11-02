/**
 * Tipos estáticos ≠ garantias em runtime.
 *
 * O TypeScript verifica o código durante a compilação, mas os dados que chegam
 * de fora da aplicação não passam automaticamente por essa verificação. Uma
 * resposta HTTP, uma variável de ambiente ou um JSON pode ter qualquer formato
 * em runtime, mesmo quando uma função declara um tipo mais específico.
 */

// Trate toda fronteira de confiança (HTTP, banco, filas, variáveis de ambiente,
// localStorage e JSON.parse) como unknown e valide antes de estreitar o tipo.
import { z } from 'zod';

// O schema é a regra executável: ele verifica os dados em runtime.
const UsuarioSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
});

// z.infer deriva um tipo para o compilador, mas não valida nenhum valor sozinho.
type Usuario = z.infer<typeof UsuarioSchema>;

async function buscarUsuario(id: number): Promise<Usuario> {
  const resp = await fetch(`https://api.exemplo.com/usuarios/${id}`);

  // fetch rejeita principalmente falhas de rede; status HTTP 4xx/5xx exigem
  // uma verificação explícita.
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  // resp.json() contém dados externos. O parse do schema é a fronteira que
  // permite retornar esses dados com segurança como Usuario.
  return UsuarioSchema.parse(await resp.json()); // falha aqui, na fronteira
}

// ------------------------------------------------------------------------------
const ConfigSchema = z.object({
  porta: z.int().min(1024).max(65535).default(3000),
  debug: z.boolean().default(false)
  // Como APP_CONFIG é interpretada como JSON, debug deve ser um booleano real.
  // Se o valor viesse diretamente de process.env, ele seria uma string e a
  // transformação comentada abaixo seria uma alternativa apropriada.
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
      // JSON.parse verifica apenas a sintaxe. O formato do valor ainda não foi
      // validado, por isso ele permanece exposto como unknown.
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

// safeParse não lança exceção para dados inválidos: informa o resultado por
// meio de success e só oferece data com o tipo validado quando ele é true.
if (!resultado.success) {
  const mensagens = resultado.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  console.error(`APP_CONFIG inválida:\n${mensagens}`);
  process.exit(1);
}

const data = resultado.data;

console.log(`Porta ${data.porta}, Debug: ${data.debug}`);
