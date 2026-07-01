import { get } from "@vercel/blob";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { blobs } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { verifyPortalToken } from "@/lib/portal";
import { streamBlobRow } from "@/lib/serve-blob";

export const dynamic = "force-dynamic";

/**
 * Sirve un archivo al cliente autenticado en el portal (sin sesión de app).
 * Requiere un token de portal válido (cookie firmada) y limita el acceso al
 * tenant del cliente. El id del blob es un UUID no adivinable.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = (await cookies()).get("portal")?.value;
  const payload = verifyPortalToken(token);
  if (!payload) return new Response("No autorizado", { status: 401 });

  const { id } = await params;
  const file = await withTenant(payload.tenantId, (tx) =>
    tx.query.blobs.findFirst({ where: eq(blobs.id, id) }),
  );
  if (!file) return new Response("No encontrado", { status: 404 });
  return streamBlobRow(file, get);
}
