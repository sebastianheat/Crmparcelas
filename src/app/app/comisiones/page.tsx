import {
  Card,
  CardHeader,
  EmptyState,
  Stat,
} from "@/components/ui";
import { ROLE_LABELS, can } from "@/lib/roles";
import { formatClp } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { setCommissionPct } from "@/server/actions";
import { getCommissions } from "@/server/queries";

export default async function CommissionsPage() {
  const session = await requireSession();
  if (!can(session.role, "finance:read")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo finanzas / CEO puede ver las comisiones."
      />
    );
  }
  const canEdit = can(session.role, "finance:write");
  const { rows, totals } = await getCommissions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Comisiones</h1>
        <p className="text-sm text-slate-500">
          Comisión por vendedor sobre los cobros efectivamente atribuidos
          (reservas, promesas y cuotas pagadas). Define el % de cada vendedor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Cobros atribuidos" value={formatClp(totals.cobros)} />
        <Stat label="Comisiones a pagar" value={formatClp(totals.comision)} />
      </div>

      <Card>
        <CardHeader
          title="Por vendedor"
          subtitle="El % se aplica sobre los cobros atribuidos a cada vendedor."
        />
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Aún no hay vendedores ni cobros" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Vendedor</th>
                  <th className="px-5 py-3 font-medium">Rol</th>
                  <th className="px-5 py-3 text-right font-medium">Cobros</th>
                  <th className="px-5 py-3 text-right font-medium">% comisión</th>
                  <th className="px-5 py-3 text-right font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-b border-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {r.name}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {ROLE_LABELS[r.role] ?? r.role}
                    </td>
                    <td className="px-5 py-3 text-right">{formatClp(r.cobros)}</td>
                    <td className="px-5 py-3 text-right">
                      {canEdit ? (
                        <form
                          action={setCommissionPct}
                          className="flex items-center justify-end gap-1"
                        >
                          <input type="hidden" name="userId" value={r.userId} />
                          <input
                            name="commissionPct"
                            defaultValue={r.pct || ""}
                            inputMode="decimal"
                            placeholder="0"
                            className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                          />
                          <span className="text-slate-400">%</span>
                          <button className="ml-1 text-xs font-medium text-brand-600 hover:underline">
                            ✓
                          </button>
                        </form>
                      ) : (
                        <span>{r.pct ? `${r.pct}%` : "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">
                      {formatClp(r.comision)}
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
