import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Reusar la conexión entre hot-reloads en desarrollo.
const globalForDb = globalThis as unknown as {
  __pg?: ReturnType<typeof postgres>;
  __db?: ReturnType<typeof drizzle<typeof schema>>;
};

function getClient() {
  if (globalForDb.__pg) return globalForDb.__pg;
  // Acepta DATABASE_URL (local) o POSTGRES_URL (lo que inyecta la integración
  // Neon/Vercel). Pooled está bien en runtime: usamos prepare:false.
  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (o POSTGRES_URL) no está definida");
  }
  const client = postgres(connectionString, {
    max: 10,
    // Necesario para SET LOCAL dentro de transacciones de RLS.
    prepare: false,
  });
  if (process.env.NODE_ENV !== "production") globalForDb.__pg = client;
  return client;
}

function getDb() {
  if (!globalForDb.__db) {
    globalForDb.__db = drizzle(getClient(), { schema });
  }
  return globalForDb.__db;
}

/**
 * `db` sin contexto de tenant. Úsalo SOLO para tablas globales
 * (users, memberships, tenants) o desde scripts/seed.
 * Para datos de negocio usa `withTenant` (src/db/tenant.ts).
 *
 * Inicialización perezosa: no conecta al importar el módulo, solo en el primer
 * uso. Así `next build` no falla aunque DATABASE_URL no esté definida en build.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
