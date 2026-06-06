import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

// Reusar la conexión entre hot-reloads en desarrollo.
const globalForDb = globalThis as unknown as {
  __pg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__pg ??
  postgres(connectionString, {
    max: 10,
    // Necesario para SET LOCAL dentro de transacciones de RLS.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__pg = client;

/**
 * `db` sin contexto de tenant. Úsalo SOLO para tablas globales
 * (users, memberships, tenants) o desde scripts/seed.
 * Para datos de negocio usa `withTenant` (src/db/tenant.ts).
 */
export const db = drizzle(client, { schema });
export { client, schema };
