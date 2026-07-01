import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { blobs } from "@/db/schema";
import { withCurrentTenant } from "@/lib/session";
import { streamBlobRow } from "@/lib/serve-blob";

export const dynamic = "force-dynamic";

/**
 * Sirve un archivo del tenant activo (app). RLS por tenant vía sesión.
 * Los bytes vienen de Postgres o de Vercel Blob privado (get() autenticado).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const file = await withCurrentTenant((tx) =>
    tx.query.blobs.findFirst({ where: eq(blobs.id, id) }),
  );
  if (!file) return new Response("No encontrado", { status: 404 });
  return streamBlobRow(file, get);
}
