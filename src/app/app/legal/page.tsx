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
import { LEGAL_CASE_STATUS, LEGAL_CASE_TYPE } from "@/lib/labels";
import { formatClp } from "@/lib/money";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { createLegalCase, updateLegalCaseStatus } from "@/server/actions";
import { listLegalCases, listProjects } from "@/server/queries";

export default async function LegalPage() {
  const session = await requireSession();
  if (!can(session.role, "settings:write")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo el área legal / CEO puede ver las causas legales."
      />
    );
  }
  const [{ rows, totals }, projects] = await Promise.all([
    listLegalCases(),
    listProjects(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Causas legales</h1>
        <p className="text-sm text-slate-500">
          Querellas y denuncias por proyecto/cliente, con tribunal, abogado y
          perjuicio. Seguimiento del riesgo legal de la operación.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Causas vigentes" value={totals.vigentes} />
        <Stat label="Total causas" value={totals.total} />
        <Stat label="Perjuicio acumulado" value={formatClp(totals.perjuicioTotal)} />
      </div>

      <Card>
        <CardHeader title="Registrar causa" subtitle="Querella, denuncia o demanda." />
        <form action={createLegalCase} className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Proyecto">
            <Select name="projectId" defaultValue="">
              <option value="">— Sin proyecto —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select name="type" defaultValue="denuncia">
              {Object.entries(LEGAL_CASE_TYPE).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select name="status" defaultValue="vigente">
              {Object.entries(LEGAL_CASE_STATUS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Persona / cliente involucrado">
            <Input name="personName" placeholder="Nombre del cliente" />
          </Field>
          <Field label="Denunciante / querellante">
            <Input name="counterparty" />
          </Field>
          <Field label="Imputado(s) / denunciado(s)">
            <Input name="accused" placeholder="Mundo Parcelas, etc." />
          </Field>
          <Field label="Tribunal">
            <Input name="tribunal" placeholder="JG Cauquenes" />
          </Field>
          <Field label="Rol causa (RIT/RUC)">
            <Input name="rol" placeholder="1493-2025" />
          </Field>
          <Field label="Ante quién se denuncia">
            <Input name="anteQuien" placeholder="BRIDEC, Fiscalía…" />
          </Field>
          <Field label="Abogado">
            <Input name="abogado" />
          </Field>
          <Field label="Contacto abogado">
            <Input name="contactoAbogado" />
          </Field>
          <Field label="Perjuicio (CLP)">
            <Input name="perjuicioClp" inputMode="numeric" />
          </Field>
          <Field label="Fecha inicio">
            <Input name="fechaInicio" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observación">
              <Textarea name="observacion" rows={1} />
            </Field>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit">Registrar causa</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Causas (${rows.length})`} />
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin causas registradas 🎉" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Causa</th>
                  <th className="px-5 py-3 font-medium">Proyecto</th>
                  <th className="px-5 py-3 font-medium">Tribunal / Rol</th>
                  <th className="px-5 py-3 font-medium">Abogado</th>
                  <th className="px-5 py-3 text-right font-medium">Perjuicio</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, projectName }) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">
                        {LEGAL_CASE_TYPE[c.type]}
                        {c.personName ? ` · ${c.personName}` : ""}
                      </div>
                      <div className="text-xs text-slate-400">
                        {[c.counterparty && `Denunciante: ${c.counterparty}`, c.anteQuien]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {projectName ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {[c.tribunal, c.rol].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {c.abogado ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.perjuicioClp ? formatClp(c.perjuicioClp) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <form action={updateLegalCaseStatus} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <Badge tone={LEGAL_CASE_STATUS[c.status]?.tone}>
                          {LEGAL_CASE_STATUS[c.status]?.label}
                        </Badge>
                        <select
                          name="status"
                          defaultValue={c.status}
                          className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                        >
                          {Object.entries(LEGAL_CASE_STATUS).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                        <button className="text-xs font-medium text-brand-600 hover:underline">
                          ✓
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
