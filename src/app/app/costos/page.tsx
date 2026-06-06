import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Stat,
} from "@/components/ui";
import { COST_CATEGORY_LABELS } from "@/lib/labels";
import { formatClp, toNumber } from "@/lib/money";
import { createCost } from "@/server/actions";
import { getCostsDetailed, listProjects } from "@/server/queries";

export default async function CostsPage() {
  const [rows, projects] = await Promise.all([
    getCostsDetailed(),
    listProjects(),
  ]);

  const total = rows.reduce((acc, r) => acc + (toNumber(r.cost.amountClp) ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Costos</h1>
        <p className="text-sm text-slate-500">
          Carga costos por proyecto (terreno, marketing, obras…) para conocer el
          margen real.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Costos totales" value={formatClp(total)} />
        <Stat label="Registros" value={rows.length} />
        <Stat label="Proyectos" value={projects.length} />
      </div>

      <Card>
        <CardHeader title="Registrar costo" />
        <form
          action={createCost}
          className="grid items-end gap-4 p-5 sm:grid-cols-4"
        >
          <Field label="Proyecto">
            <Select name="projectId" defaultValue="">
              <option value="">General (sin proyecto)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoría">
            <Select name="category" defaultValue="marketing">
              {Object.entries(COST_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Monto (CLP)">
            <Input name="amountClp" inputMode="numeric" placeholder="7200000" />
          </Field>
          <div className="flex items-end gap-2">
            <Field label="Descripción">
              <Input name="description" placeholder="Campañas Meta mayo" />
            </Field>
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Costos registrados" />
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin costos registrados" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Proyecto</th>
                  <th className="px-5 py-3 font-medium">Categoría</th>
                  <th className="px-5 py-3 font-medium">Descripción</th>
                  <th className="px-5 py-3 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ cost, projectName }) => (
                  <tr
                    key={cost.id}
                    className="border-b border-slate-50 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(cost.incurredAt).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {projectName ?? "General"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {COST_CATEGORY_LABELS[cost.category] ?? cost.category}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {cost.description ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatClp(cost.amountClp)}
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
