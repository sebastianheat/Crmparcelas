import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Stat,
  Textarea,
} from "@/components/ui";
import { LEAD_SOURCE, LEAD_STAGE, LEAD_STAGES } from "@/lib/labels";
import { formatClp } from "@/lib/money";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { createLead } from "@/server/actions";
import { listLeads, listProjects, listSellers } from "@/server/queries";

export default async function CrmPage() {
  const session = await requireSession();
  if (!can(session.role, "reservas:create")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="El embudo de ventas es para el equipo comercial."
      />
    );
  }
  const [{ rows, stats }, projects, sellers] = await Promise.all([
    listLeads(),
    listProjects(),
    listSellers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">CRM y Embudo</h1>
        <p className="text-sm text-slate-500">
          Tus leads desde el primer contacto hasta la reserva, con asignación a
          vendedores y seguimiento por etapa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Leads activos" value={stats.activos} />
        <Stat label="Ganados" value={stats.ganados} />
        <Stat label="Conversión" value={`${stats.conversion}%`} />
        <Stat label="Pipeline (estimado)" value={formatClp(stats.pipelineValue)} />
      </div>

      <Card>
        <CardHeader title="Nuevo lead" subtitle="Captura un interesado y asígnalo." />
        <form action={createLead} className="grid gap-4 p-5 sm:grid-cols-4">
          <Field label="Nombre">
            <Input name="name" required placeholder="Nombre del interesado" />
          </Field>
          <Field label="Teléfono">
            <Input name="phone" placeholder="+569…" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <Field label="Origen">
            <Select name="source" defaultValue="web">
              {Object.entries(LEAD_SOURCE).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proyecto de interés">
            <Select name="projectId" defaultValue="">
              <option value="">— Sin definir —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Asignar a">
            <Select name="assignedToUserId" defaultValue="">
              <option value="">— Sin asignar —</option>
              {sellers.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor estimado (CLP)">
            <Input name="estimatedValueClp" inputMode="numeric" />
          </Field>
          <div className="sm:col-span-4">
            <Field label="Notas">
              <Textarea name="notes" rows={1} />
            </Field>
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <Button type="submit">Agregar lead</Button>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="Sin leads aún" description="Agrega tu primer interesado arriba." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAD_STAGES.map((stage) => {
            const colLeads = rows.filter((r) => r.lead.stage === stage);
            const s = LEAD_STAGE[stage];
            return (
              <div key={stage} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-slate-700">
                    {s.label}
                  </span>
                  <Badge tone={s.tone}>{colLeads.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colLeads.map(({ lead, assignedName, projectName }) => (
                    <Link key={lead.id} href={`/app/crm/${lead.id}`}>
                      <Card className="p-3 transition-shadow hover:shadow-md">
                        <p className="font-medium text-slate-900">{lead.name}</p>
                        <p className="text-xs text-slate-400">
                          {LEAD_SOURCE[lead.source]}
                          {projectName ? ` · ${projectName}` : ""}
                        </p>
                        {lead.estimatedValueClp && (
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            {formatClp(lead.estimatedValueClp)}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-slate-400">
                          {assignedName ? `👤 ${assignedName}` : "Sin asignar"}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
