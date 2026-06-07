import { Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { formatClp } from "@/lib/money";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { getCashFlow } from "@/server/queries";

export default async function CashFlowPage() {
  const session = await requireSession();
  if (!can(session.role, "finance:read")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="El flujo de caja es para finanzas / CEO."
      />
    );
  }
  const { months, maxMonth, byProject, totals } = await getCashFlow();
  const hasData = totals.comprometido > 0 || totals.recaudado > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Flujo de caja</h1>
        <p className="text-sm text-slate-500">
          Proyección de ingresos a partir de las cuotas comprometidas (crédito
          directo).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Comprometido (por cobrar)" value={formatClp(totals.comprometido)} />
        <Stat label="Próximos 30 días" value={formatClp(totals.prox30)} />
        <Stat label="Próximos 90 días" value={formatClp(totals.prox90)} />
        <Stat label="Vencido" value={formatClp(totals.vencido)} />
      </div>

      {!hasData ? (
        <Card>
          <div className="p-5">
            <EmptyState
              title="Aún no hay cuotas"
              description="Crea planes de pago en las parcelas para ver la proyección."
            />
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Proyección de ingresos (12 meses)"
              subtitle="Suma de cuotas con vencimiento en cada mes."
            />
            <div className="p-5">
              <div className="flex h-56 items-end gap-2">
                {months.map((m) => (
                  <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-brand-500 transition-all hover:bg-brand-600"
                        style={{
                          height: `${Math.max(2, (m.projected / maxMonth) * 100)}%`,
                        }}
                        title={formatClp(m.projected)}
                      />
                    </div>
                    <span className="text-[10px] capitalize text-slate-400">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-xs text-slate-400">
                <span>Recaudado a la fecha: {formatClp(totals.recaudado)}</span>
                <span>Máx mensual: {formatClp(maxMonth)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Comprometido por proyecto" />
            {byProject.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Sin datos por proyecto" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {byProject.map((p) => (
                      <tr key={p.name} className="border-b border-slate-50">
                        <td className="px-5 py-3 text-slate-700">{p.name}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-900">
                          {formatClp(p.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
