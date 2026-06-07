import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
} from "@/components/ui";
import {
  LEAD_ACTIVITY_TYPE,
  LEAD_SOURCE,
  LEAD_STAGE,
  LEAD_STAGES,
} from "@/lib/labels";
import { formatClp } from "@/lib/money";
import {
  addLeadActivity,
  assignLead,
  convertLeadToClient,
  updateLeadStage,
} from "@/server/actions";
import { getLead, listSellers } from "@/server/queries";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, sellers] = await Promise.all([getLead(id), listSellers()]);
  if (!data) notFound();
  const { lead, assignedName, projectName, activities } = data;
  const stage = LEAD_STAGE[lead.stage];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app/crm" className="text-sm text-slate-400 hover:underline">
            ← Embudo
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {lead.name}
          </h1>
          <p className="text-sm text-slate-500">
            {LEAD_SOURCE[lead.source]}
            {projectName ? ` · interés: ${projectName}` : ""}
          </p>
        </div>
        <Badge tone={stage.tone}>{stage.label}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Timeline */}
        <Card>
          <CardHeader title="Seguimiento" subtitle="Registra cada interacción." />
          <div className="p-5">
            <form action={addLeadActivity} className="mb-5 flex flex-wrap items-end gap-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <Field label="Tipo">
                <Select name="type" defaultValue="nota">
                  {Object.entries(LEAD_ACTIVITY_TYPE)
                    .filter(([v]) => v !== "cambio_etapa")
                    .map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                </Select>
              </Field>
              <div className="flex-1">
                <Field label="Nota">
                  <Input name="note" placeholder="Resumen de la interacción…" />
                </Field>
              </div>
              <Button type="submit">Agregar</Button>
            </form>

            {activities.length === 0 ? (
              <p className="text-sm text-slate-400">Sin actividad registrada.</p>
            ) : (
              <ul className="space-y-3">
                {activities.map(({ activity, authorName }) => (
                  <li key={activity.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                    <div>
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">
                          {LEAD_ACTIVITY_TYPE[activity.type]}
                        </span>
                        {activity.note ? ` — ${activity.note}` : ""}
                      </p>
                      <p className="text-xs text-slate-400">
                        {authorName ?? "—"} ·{" "}
                        {new Date(activity.createdAt).toLocaleString("es-CL")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Panel lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Datos" />
            <dl className="space-y-2 p-5 text-sm">
              <Row label="Teléfono" value={lead.phone} />
              <Row label="Email" value={lead.email} />
              <Row
                label="Valor estimado"
                value={lead.estimatedValueClp ? formatClp(lead.estimatedValueClp) : null}
              />
              <Row label="Asignado a" value={assignedName} />
              {lead.notes && <Row label="Notas" value={lead.notes} />}
              {lead.lostReason && <Row label="Motivo pérdida" value={lead.lostReason} />}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Gestión" />
            <div className="space-y-4 p-5">
              <form action={updateLeadStage} className="space-y-2">
                <input type="hidden" name="id" value={lead.id} />
                <Field label="Mover a etapa">
                  <Select name="stage" defaultValue={lead.stage}>
                    {LEAD_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STAGE[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Input name="lostReason" placeholder="Motivo (si se pierde)" />
                <Button type="submit" className="w-full">
                  Actualizar etapa
                </Button>
              </form>

              <form action={assignLead} className="space-y-2">
                <input type="hidden" name="id" value={lead.id} />
                <Field label="Reasignar vendedor">
                  <Select
                    name="assignedToUserId"
                    defaultValue={lead.assignedToUserId ?? ""}
                  >
                    <option value="">— Sin asignar —</option>
                    {sellers.map((s) => (
                      <option key={s.userId} value={s.userId}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" variant="secondary" className="w-full">
                  Guardar asignación
                </Button>
              </form>

              {!lead.clientId && (
                <form action={convertLeadToClient}>
                  <input type="hidden" name="id" value={lead.id} />
                  <Button type="submit" className="w-full">
                    ✓ Convertir en cliente
                  </Button>
                </form>
              )}
              {lead.clientId && (
                <p className="text-center text-xs text-emerald-600">
                  Lead convertido en cliente.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value ?? "—"}</dd>
    </div>
  );
}
