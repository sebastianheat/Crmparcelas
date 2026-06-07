import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Select,
} from "@/components/ui";
import { CLIENT_DOC_LABELS, CLIENT_DOC_TYPES } from "@/lib/labels";
import { createPortalToken } from "@/lib/portal";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { deleteClientDocument, uploadClientDocument } from "@/server/actions";
import { getClient } from "@/server/queries";

export default async function ClientFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const canWrite = can(session.role, "events:write");
  const client = await getClient(id);
  if (!client) notFound();

  const present = new Set<string>(client.documents.map((d) => d.type));
  const portalBase = process.env.APP_URL ?? "https://5000.cl";
  const portalLink = `${portalBase}/portal/acceso?t=${createPortalToken(session.tenantId, client.id)}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/clientes" className="text-sm text-slate-400 hover:underline">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{client.name}</h1>
        <p className="text-sm text-slate-500">
          Expediente digital del cliente — documentos, checklist y parcelas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Documentos + checklist */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Checklist documental"
              subtitle="Lo necesario para cerrar la venta con orden."
            />
            <ul className="grid gap-2 p-5 sm:grid-cols-2">
              {CLIENT_DOC_TYPES.filter((t) => t.value !== "otro").map((t) => {
                const ok = present.has(t.value);
                return (
                  <li
                    key={t.value}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        ok ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {ok ? "✓" : "○"}
                    </span>
                    <span className={ok ? "text-slate-800" : "text-slate-500"}>
                      {t.label}
                    </span>
                    {t.required && !ok && (
                      <span className="ml-auto text-[10px] font-semibold text-amber-600">
                        requerido
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title={`Documentos (${client.documents.length})`} />
            {canWrite && (
              <form
                action={uploadClientDocument}
                className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-5"
              >
                <input type="hidden" name="clientId" value={client.id} />
                <Field label="Tipo">
                  <Select name="docType" defaultValue="cedula">
                    {CLIENT_DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex-1">
                  <Field label="Archivo">
                    <input
                      type="file"
                      name="file"
                      required
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
                    />
                  </Field>
                </div>
                <Button type="submit">Subir</Button>
              </form>
            )}
            {client.documents.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Sin documentos cargados" />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-600 hover:underline"
                      >
                        📄 {d.title}
                      </a>
                      <p className="text-xs text-slate-400">
                        {CLIENT_DOC_LABELS[d.type] ?? d.type} ·{" "}
                        {new Date(d.createdAt).toLocaleDateString("es-CL")}
                      </p>
                    </div>
                    {canWrite && (
                      <form action={deleteClientDocument}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="clientId" value={client.id} />
                        <button className="text-xs text-slate-400 hover:text-red-600 hover:underline">
                          eliminar
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Datos + parcelas */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Datos" />
            <dl className="space-y-2 p-5 text-sm">
              {[
                ["RUT", client.rut],
                ["Estado civil", client.estadoCivil],
                ["Profesión", client.profesion],
                ["Nacionalidad", client.nacionalidad],
                ["Email", client.email],
                ["Teléfono", client.phone],
                ["Dirección", client.direccion],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="text-right font-medium text-slate-700">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {canWrite && (
            <Card>
              <CardHeader
                title="Portal del cliente"
                subtitle="Enlace de acceso para que el cliente vea su parcela, pagos y documentos."
              />
              <div className="p-5">
                <input
                  readOnly
                  value={portalLink}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Cópialo y envíalo por WhatsApp/email. Vence en 30 días.
                </p>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={`Parcelas (${client.parcels.length})`} />
            {client.parcels.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Sin parcelas asignadas" />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.parcels.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/app/parcelas/${p.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-700">
                        {p.projectName} · {p.code}
                      </span>
                      <Badge tone="slate">{p.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
