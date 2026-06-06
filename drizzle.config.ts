import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // DDL con el rol owner; cae a DATABASE_URL si no hay URL admin.
    url: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
