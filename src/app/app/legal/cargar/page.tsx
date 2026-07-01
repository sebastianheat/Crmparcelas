import { Card, CardHeader } from "@/components/ui";
import { listClientsForUpload } from "@/server/queries";
import { BulkUploader } from "./bulk-uploader";

export const metadata = { title: "Cargar documentos — 5000" };
export const maxDuration = 60;

export default async function CargarDocumentosPage() {
  const clients = await listClientsForUpload();
  const blobOn = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Cargar documentos (carpeta digital)
        </h1>
        <p className="text-sm text-slate-500">
          Sube la reserva, promesa, escritura e inscripción de cada cliente.
          Quedan en su carpeta digital y visibles en su portal.
        </p>
      </div>

      {!blobOn && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Nota:</strong> Vercel Blob aún no está activo — los archivos se
          guardan en la base de datos. Para archivos pesados, activa Blob
          (Vercel → Storage → Blob) y define <code>BLOB_READ_WRITE_TOKEN</code>.
          No necesitas volver a subir nada: al activarlo, las cargas nuevas irán
          a Blob automáticamente.
        </div>
      )}

      <Card>
        <CardHeader
          title={`Clientes (${clients.length})`}
          subtitle="Elige un cliente, el tipo y arrastra sus archivos. Puedes subir varios a la vez."
        />
        <BulkUploader clients={clients} />
      </Card>
    </div>
  );
}
