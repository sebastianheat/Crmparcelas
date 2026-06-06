/**
 * Seed de datos demo (local, vía postgres.js / TCP).
 * Para Neon sobre HTTPS usa: scripts/remote-setup.ts
 *
 * Ejecutar: pnpm db:seed
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { ADMIN_EMAIL, ADMIN_PASSWORD, seedDemo } from "./seed-core";

const adminUrl =
  process.env.DATABASE_ADMIN_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;
if (!adminUrl) throw new Error("Define DATABASE_ADMIN_URL o DATABASE_URL");

const sqlClient = postgres(adminUrl, { max: 1, prepare: false });
const db = drizzle(sqlClient, { schema });

async function main() {
  console.log("🌱 Sembrando datos demo…");
  await seedDemo(db);
  console.log("✅ Seed completo.");
  console.log(`   Login:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
}

main()
  .then(() => sqlClient.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("❌ Error en seed:", err);
    await sqlClient.end();
    process.exit(1);
  });
