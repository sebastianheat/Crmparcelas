import { Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { importLeadsCsv } from "@/server/actions";

export default async function ImportPage({
  searchParams,
}: PageProps<"/app/importar">) {
  const session = await requireSession();
  if (!can(session.role, "reservas:create")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="La importación es para el equipo comercial."
      />
    );
  }
  const sp = await searchParams;
  const ok = typeof sp?.ok === "string" ? sp.ok : null;
  const skip = typeof sp?.skip === "string" ? sp.skip : null;
  const err = sp?.err === "1";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Importar leads</h1>
        <p className="text-sm text-slate-500">
          Carga tus contactos/oportunidades desde un CSV (export de GHL/Toscana u
          otra fuente) al embudo de 5000.
        </p>
      </div>

      {ok && (
        <div className="rounded-xl bg-brand-50 p-4 text-sm font-medium text-brand-700">
          ✓ Importados {ok} leads{skip ? ` · ${skip} omitidos (duplicados o sin nombre)` : ""}.
        </div>
      )}
      {err && (
        <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
          No pudimos leer el CSV. Revisa el archivo o el texto pegado.
        </div>
      )}

      <Card>
        <CardHeader
          title="Subir CSV"
          subtitle="Detecta solo las columnas (nombre, teléfono, email, etapa, origen, valor)."
        />
        <form action={importLeadsCsv} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Archivo CSV
            </label>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
            />
          </div>
          <div className="text-center text-xs text-slate-400">— o pega el contenido —</div>
          <textarea
            name="csvText"
            rows={6}
            placeholder="Nombre,Teléfono,Email,Etapa,Origen,Valor&#10;Juan Pérez,+56990000000,juan@correo.cl,Reunión,WhatsApp,15000000"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button type="submit">Importar</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Cómo exportar desde GHL (Toscana)" />
        <div className="p-5 text-sm text-slate-600">
          <ol className="list-decimal space-y-1 pl-5">
            <li>En GHL ve a <strong>Contacts</strong> (o <strong>Opportunities</strong>).</li>
            <li>Aplica filtros si quieres (pipeline, etapa).</li>
            <li>Botón <strong>Export</strong> → descarga el CSV.</li>
            <li>Súbelo aquí. Las etapas se mapean a las 13 etapas Toscana automáticamente.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-400">
            Se omiten filas sin nombre y los duplicados por teléfono o email.
          </p>
        </div>
      </Card>
    </div>
  );
}
