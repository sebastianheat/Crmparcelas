import type { get as BlobGet } from "@vercel/blob";
import type { Blob as BlobRow } from "@/db/schema";

/**
 * Devuelve una Response con el contenido de un registro `blobs`, ya sea desde
 * Postgres (bytea) o desde Vercel Blob privado (stream con get() autenticado).
 * Recibe `get` por parámetro para no acoplar la ruta al SDK en tests.
 */
/**
 * Content-Disposition seguro (RFC 5987/6266): las cabeceras HTTP solo aceptan
 * Latin-1, y nombres con tildes en forma NFD (p. ej. "Agrícola" con tilde
 * combinante U+0301) hacían lanzar a `new Response()` → descarga rota (500).
 * Se envía un fallback ASCII y el nombre real UTF-8 percent-encoded.
 */
function contentDisposition(filename: string): string {
  const ascii =
    filename
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/["\\]/g, "'")
      .trim() || "archivo";
  const utf8 = encodeURIComponent(filename.normalize("NFC"));
  return `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

export async function streamBlobRow(
  file: Pick<BlobRow, "id" | "mime" | "filename" | "data" | "pathname">,
  get: typeof BlobGet,
): Promise<Response> {
  const filename = file.filename ?? file.id;

  if (file.pathname) {
    const res = await get(file.pathname, { access: "private" });
    if (!res || res.statusCode !== 200 || !res.stream) {
      return new Response("No encontrado", { status: 404 });
    }
    return new Response(res.stream, {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": contentDisposition(filename),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (!file.data) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": contentDisposition(filename),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
