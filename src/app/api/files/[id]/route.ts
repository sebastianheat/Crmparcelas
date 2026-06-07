import { eq } from "drizzle-orm";
import { blobs } from "@/db/schema";
import { withCurrentTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Sirve un archivo guardado en Postgres (fallback sin Vercel Blob). RLS por tenant. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const file = await withCurrentTenant((tx) =>
    tx.query.blobs.findFirst({ where: eq(blobs.id, id) }),
  );
  if (!file) return new Response("No encontrado", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${file.filename ?? id}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
