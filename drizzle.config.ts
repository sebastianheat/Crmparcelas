import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // DDL con el rol owner; prioriza la conexión directa (no pooled) para
    // migraciones. Cae a las variables que inyecta Neon/Vercel.
    url:
      process.env.DATABASE_ADMIN_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL!,
  },
  verbose: true,
  strict: true,
});
