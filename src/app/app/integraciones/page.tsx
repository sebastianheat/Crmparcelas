import { Badge, Button, Card, CardHeader, EmptyState, Field, Input } from "@/components/ui";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { saveGhlConfig, syncGhlLeads, testGhlConnection } from "@/server/actions";
import { getGhlIntegration } from "@/server/queries";

export default async function IntegrationsPage({
  searchParams,
}: PageProps<"/app/integraciones">) {
  const session = await requireSession();
  if (!can(session.role, "settings:write")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Las integraciones las configura el CEO / administrador."
      />
    );
  }
  const sp = await searchParams;
  const { configured, locationId, lastSyncAt } = await getGhlIntegration();

  const banner =
    sp?.saved === "1"
      ? { tone: "ok", msg: "Configuración guardada." }
      : sp?.test === "ok"
        ? { tone: "ok", msg: `Conexión OK · ${sp.pipelines ?? 0} pipeline(s) detectados.` }
        : sp?.test === "err"
          ? { tone: "err", msg: "No se pudo conectar. Revisa el token y el Location ID." }
          : sp?.sync === "ok"
            ? { tone: "ok", msg: `Sincronización OK · ${sp.new ?? 0} nuevos, ${sp.upd ?? 0} actualizados.` }
            : sp?.sync === "err"
              ? { tone: "err", msg: "Error al sincronizar. Revisa el token/permisos o reintenta." }
              : sp?.sync === "nocfg" || sp?.err === "cfg"
                ? { tone: "err", msg: "Falta configurar el token y el Location ID." }
                : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Integraciones</h1>
        <p className="text-sm text-slate-500">
          Conecta fuentes externas. Hoy: GoHighLevel / LeadConnector (Toscana de
          HEAT) para traer las oportunidades al embudo.
        </p>
      </div>

      {banner && (
        <div
          className={`rounded-xl p-4 text-sm font-medium ${
            banner.tone === "ok"
              ? "bg-brand-50 text-brand-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {banner.msg}
        </div>
      )}

      <Card>
        <CardHeader
          title="GoHighLevel (LeadConnector)"
          subtitle="Sincroniza oportunidades como leads, mapeando la etapa a tu embudo."
          action={
            <Badge tone={configured ? "green" : "amber"}>
              {configured ? "Configurado" : "Sin configurar"}
            </Badge>
          }
        />
        <form action={saveGhlConfig} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Private Integration Token">
            <Input
              name="token"
              type="password"
              placeholder={configured ? "•••••••• (guardado)" : "pit-..."}
              autoComplete="off"
            />
          </Field>
          <Field label="Location ID">
            <Input
              name="locationId"
              defaultValue={locationId || "u1Ya2h9SSGrwCZJ7PSUv"}
              placeholder="u1Ya2h9SSGrwCZJ7PSUv"
            />
          </Field>
          <div className="sm:col-span-2 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {lastSyncAt
                ? `Última sincronización: ${new Date(lastSyncAt).toLocaleString("es-CL")}`
                : "Aún no sincronizado."}
            </p>
            <Button type="submit">Guardar</Button>
          </div>
        </form>

        {configured && (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 p-5">
            <form action={testGhlConnection}>
              <Button type="submit" variant="secondary">
                Probar conexión
              </Button>
            </form>
            <form action={syncGhlLeads}>
              <Button type="submit">↻ Sincronizar leads ahora</Button>
            </form>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Cómo obtener el token" />
        <div className="p-5 text-sm text-slate-600">
          <ol className="list-decimal space-y-1 pl-5">
            <li>En GHL (Toscana): <strong>Settings → Private Integrations</strong>.</li>
            <li>Crea una integración con scopes de <strong>Opportunities</strong> y <strong>Contacts</strong> (lectura).</li>
            <li>Copia el <strong>token</strong> y pégalo arriba. El <strong>Location ID</strong> va en la URL del launchpad.</li>
            <li>Guarda → <strong>Probar conexión</strong> → <strong>Sincronizar</strong>. Los leads aparecen en el CRM.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-400">
            La sincronización es idempotente: re-sincronizar actualiza la etapa y
            el valor sin duplicar.
          </p>
        </div>
      </Card>
    </div>
  );
}
