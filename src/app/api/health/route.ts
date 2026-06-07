import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

/**
 * Healthcheck de integraciones. NO expone secretos: solo indica si cada
 * variable/servicio está configurado. Útil para verificar el entorno en prod.
 */
export async function GET() {
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    ok: dbOk,
    db: dbOk,
    database_url: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    auth_secret: Boolean(process.env.AUTH_SECRET),
    dte_provider: process.env.DTE_PROVIDER ?? null,
    bank_provider: process.env.BANK_PROVIDER ?? null,
    ts: new Date().toISOString(),
  });
}
