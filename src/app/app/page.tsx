import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Stat } from "@/components/ui";
import { LEGAL_STATUS, PROJECT_STATUS, RIESGO } from "@/lib/labels";
import { formatClp } from "@/lib/money";
import { getDashboard } from "@/server/queries";

export default async function DashboardPage() {
  const { projects, totals, projectCount } = await getDashboard();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Orden contable y trazabilidad de tu operación parceladora.
          </p>
        </div>
        <LinkButton href="/app/proyectos/nuevo">+ Nuevo proyecto</LinkButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Dinero ingresado"
          value={formatClp(totals.ingresosClp)}
          hint="Comprobantes registrados (prefactura)"
        />
        <Stat
          label="Prometido"
          value={formatClp(totals.prometidoClp)}
          hint="Valor de parcelas con promesa vigente"
        />
        <Stat
          label="Escriturado"
          value={formatClp(totals.escrituradoClp)}
          hint="Valor de parcelas escrituradas"
        />
        <Stat
          label="Margen de caja"
          value={formatClp(totals.margenClp)}
          hint="Ingresos − costos cargados"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Proyectos" value={projectCount} />
        <Stat label="Stock total" value={totals.totalUnits} />
        <Stat
          label="Disponibles"
          value={totals.freeUnits}
          hint={`${totals.totalUnits - totals.freeUnits} comprometidas/vendidas`}
        />
      </div>

      <Card>
        <CardHeader
          title="Resultado por proyecto"
          subtitle="El dolor #1 del rubro: saber cuánto gana cada proyecto."
        />
        {projects.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Aún no hay proyectos"
              description="Crea tu primer proyecto para empezar a cargar stock y movimientos."
              action={
                <LinkButton href="/app/proyectos/nuevo">
                  Crear proyecto
                </LinkButton>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Proyecto</th>
                  <th className="px-5 py-3 font-medium">Stock</th>
                  <th className="px-5 py-3 text-right font-medium">Ingresado</th>
                  <th className="px-5 py-3 text-right font-medium">Prometido</th>
                  <th className="px-5 py-3 text-right font-medium">Costos</th>
                  <th className="px-5 py-3 text-right font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const st = PROJECT_STATUS[p.status];
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/app/proyectos/${p.slug}`}
                          className="font-medium text-slate-900 hover:text-brand-600"
                        >
                          {p.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge tone={st?.tone}>{st?.label ?? p.status}</Badge>
                          <Badge tone={LEGAL_STATUS[p.legalStatus]?.tone}>
                            {LEGAL_STATUS[p.legalStatus]?.label ?? p.legalStatus}
                          </Badge>
                          {p.riesgo !== "bajo" && (
                            <Badge tone={RIESGO[p.riesgo]?.tone}>
                              {RIESGO[p.riesgo]?.label}
                            </Badge>
                          )}
                          {p.denuncias > 0 && (
                            <Badge tone="red">{p.denuncias} den.</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {p.freeUnits}/{p.totalUnits} libres
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {formatClp(p.ingresosClp)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {formatClp(p.prometidoClp)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {formatClp(p.costosClp)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-medium ${
                          p.margenClp >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {formatClp(p.margenClp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
