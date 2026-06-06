import { put } from "@vercel/blob";

/**
 * Sube un archivo a Vercel Blob y devuelve su URL pública.
 * Requiere BLOB_READ_WRITE_TOKEN (se crea al habilitar Vercel Blob en el proyecto).
 */
export async function uploadBlob(
  pathname: string,
  body: Parameters<typeof put>[1],
  contentType?: string,
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Falta BLOB_READ_WRITE_TOKEN. Habilita Vercel Blob en el proyecto (Storage → Blob).",
    );
  }
  const { url } = await put(pathname, body, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
  return url;
}
