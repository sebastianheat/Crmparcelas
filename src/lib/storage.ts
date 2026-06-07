import { put } from "@vercel/blob";
import { blobs } from "@/db/schema";
import { withTenant } from "@/db/tenant";

/**
 * Guarda un archivo y devuelve su URL.
 *  - Si BLOB_READ_WRITE_TOKEN está configurado → Vercel Blob (URL pública, escalable).
 *  - Si no → Postgres (bytea), servido por /api/files/[id]. Sin setup externo.
 * Misma firma para ambos: cambiar de backend no toca la lógica de negocio.
 */
export async function storeFile(opts: {
  tenantId: string;
  pathname: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<string> {
  const { tenantId, pathname, bytes, contentType } = opts;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(pathname, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });
    return url;
  }

  const id = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .insert(blobs)
      .values({
        tenantId,
        filename: pathname.split("/").pop() ?? null,
        mime: contentType,
        data: Buffer.from(bytes),
      })
      .returning({ id: blobs.id });
    return row.id;
  });
  return `/api/files/${id}`;
}
