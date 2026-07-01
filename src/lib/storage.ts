import { put } from "@vercel/blob";
import { blobs } from "@/db/schema";
import { withTenant } from "@/db/tenant";

/**
 * Guarda un archivo y devuelve una URL estable servida por la app
 * (`/api/files/<id>`), con control de acceso por tenant.
 *
 * El registro en `blobs` (con tenant_id + RLS) es la fuente de verdad; los
 * bytes viven en uno de dos backends, transparente para el negocio:
 *  - Vercel Blob PRIVADO si BLOB_READ_WRITE_TOKEN está configurado → sólo se
 *    guarda el `pathname`; el contenido se sirve con get() autenticado. Ideal
 *    para documentos legales (escrituras, cédulas): no quedan públicos.
 *  - Postgres (bytea) si no hay token → sin setup externo.
 *
 * En ambos casos la URL pasa por `/api/files/[id]`, así el portal del cliente
 * y la app aplican control de acceso (a diferencia de una URL pública directa).
 */
export async function storeFile(opts: {
  tenantId: string;
  pathname: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<string> {
  const { tenantId, pathname, bytes, contentType } = opts;
  const filename = pathname.split("/").pop() ?? null;

  let blobPathname: string | null = null;
  let data: Buffer | null = Buffer.from(bytes);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const res = await put(pathname, Buffer.from(bytes), {
      access: "private",
      addRandomSuffix: true,
      contentType,
    });
    blobPathname = res.pathname;
    data = null; // los bytes viven en Vercel Blob, no en Postgres
  }

  const id = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .insert(blobs)
      .values({
        tenantId,
        filename,
        mime: contentType,
        data,
        pathname: blobPathname,
      })
      .returning({ id: blobs.id });
    return row.id;
  });
  return `/api/files/${id}`;
}
