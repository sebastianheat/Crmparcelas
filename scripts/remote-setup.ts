/**
 * Setup remoto contra Neon SOBRE HTTPS/443 (cuando el puerto 5432 está bloqueado).
 * Aplica migraciones (drizzle/*.sql) y siembra datos demo usando el driver
 * serverless de Neon por WebSocket.
 *
 * Uso:
 *   REMOTE_DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
 *     pnpm tsx scripts/remote-setup.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../src/db/schema";
import { ADMIN_EMAIL, ADMIN_PASSWORD, seedDemo } from "../src/db/seed-core";

neonConfig.webSocketConstructor = ws;

const url = process.env.REMOTE_DATABASE_URL;
if (!url) throw new Error("Define REMOTE_DATABASE_URL");

const root = process.cwd();
const migrations = ["drizzle/0000_init.sql", "drizzle/0001_rls.sql"];

/**
 * Divide un script SQL en sentencias individuales (el driver serverless usa
 * protocolo extendido y no acepta múltiples sentencias por consulta). Respeta
 * bloques $$…$$ (cuerpos de función), strings '…' y comentarios -- y /* *​/.
 */
function splitSql(input: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inLine = false;
  let inBlock = false;
  let inSingle = false;
  let dollar: string | null = null;
  while (i < input.length) {
    const c = input[i];
    const two = input.slice(i, i + 2);
    if (inLine) {
      buf += c;
      if (c === "\n") inLine = false;
      i++;
    } else if (inBlock) {
      buf += c;
      if (two === "*/") {
        buf += "/";
        i += 2;
        inBlock = false;
      } else i++;
    } else if (inSingle) {
      buf += c;
      if (c === "'") inSingle = false;
      i++;
    } else if (dollar) {
      if (input.startsWith(dollar, i)) {
        buf += dollar;
        i += dollar.length;
        dollar = null;
      } else {
        buf += c;
        i++;
      }
    } else if (two === "--") {
      inLine = true;
      buf += two;
      i += 2;
    } else if (two === "/*") {
      inBlock = true;
      buf += two;
      i += 2;
    } else if (c === "'") {
      inSingle = true;
      buf += c;
      i++;
    } else {
      const m =
        c === "$" ? input.slice(i).match(/^\$[a-zA-Z0-9_]*\$/) : null;
      if (m) {
        dollar = m[0];
        buf += m[0];
        i += m[0].length;
      } else if (c === ";") {
        out.push(buf.trim());
        buf = "";
        i++;
      } else {
        buf += c;
        i++;
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  // Descartar fragmentos vacíos o que sean solo comentarios.
  return out.filter(
    (s) => s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("--") || l.trim() === ""),
  );
}

async function main() {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  console.log("🔌 Conectado a Neon (HTTPS). Aplicando migraciones…");
  for (const file of migrations) {
    const contents = readFileSync(join(root, file), "utf8");
    const statements = splitSql(contents);
    for (const stmt of statements) {
      await db.execute(sql.raw(stmt));
    }
    console.log(`   ✓ ${file} (${statements.length} sentencias)`);
  }

  console.log("🌱 Sembrando datos demo…");
  // Todo en una transacción → misma conexión → el contexto RLS de sesión se
  // mantiene para las inserciones de negocio.
  await db.transaction(async (tx) => {
    await seedDemo(tx);
  });

  await pool.end();
  console.log("✅ Listo.");
  console.log(`   Login:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
}

main().catch((err) => {
  console.error("❌ Error en setup remoto:", err);
  process.exit(1);
});
