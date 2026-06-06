/**
 * Aplica TODAS las migraciones (drizzle/*.sql) contra Neon sobre HTTPS/443,
 * de forma IDEMPOTENTE: ignora errores de "ya existe", así re-aplicar solo
 * agrega lo nuevo. NO siembra datos (no toca lo existente).
 *
 * Uso:
 *   REMOTE_DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
 *     pnpm tsx scripts/remote-migrate.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { ALREADY_EXISTS, splitSql } from "./_sql";

const url = process.env.REMOTE_DATABASE_URL;
if (!url) throw new Error("Define REMOTE_DATABASE_URL");
const dbUrl: string = url;

async function main() {
  // Driver HTTP: cada sentencia es un request autocommit independiente, así un
  // error de "ya existe" no contamina las siguientes (sin transacción abierta).
  const db = drizzle(neon(dbUrl));
  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log("🔌 Conectado a Neon (HTTPS). Aplicando migraciones…");
  for (const file of files) {
    const statements = splitSql(readFileSync(join(dir, file), "utf8"));
    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
        applied++;
      } catch (err) {
        const e = err as {
          code?: string;
          message?: string;
          cause?: { code?: string };
        };
        const code =
          e?.code ??
          e?.cause?.code ??
          e?.message?.match(/\b(42\w{3}|23505)\b/)?.[1];
        if (code && ALREADY_EXISTS.has(code)) {
          skipped++;
        } else {
          console.error(
            `\n❌ Falló en ${file} [${code ?? "?"}]: ${e?.message}\n${stmt}\n`,
          );
          throw err;
        }
      }
    }
    console.log(`   ✓ ${file} — aplicadas ${applied}, ya existían ${skipped}`);
  }

  console.log("✅ Migraciones al día.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
