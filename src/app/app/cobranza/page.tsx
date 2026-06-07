import Link from "next/link";
import { Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { formatClp } from "@/lib/money";
import { markInstallmentPaid } from "@/server/actions";
import { getCobranza } from "@/server/queries";

export default async function CobranzaPage() {
  const { totals, vencidas, proximas } = await getCobranza();

  const Row = ({
    r,
    overdue,
  }: {
    r: Awaited<ReturnType<typeof getCobranza>>["vencidas"][number];
    overdue: boolean;
  }) => (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60">
      <td className="px-5 py-3">
        {r.parcelCode ? (
          <Link
            href={`/app/parcelas/${r.inst.parcelId}`}
            className="font-medium text-slate-900 hover:text-brand-600"
          >
            {r.projectName} · {r.parcelCode}
          </Link>
        ) : (
          "—"
        )}
        <div className="text-xs text-slate-400">{r.clientName ?? "—"}</div>
      </td>
      <td className="px-5 py-3 text-slate-600">Cuota {r.inst.number}</td>
      <td className="px-5 py-3">
        <span className={overdue ? "text-red-600" : "text-slate-600"}>
          {new Date(r.inst.dueDate).toLocaleDateString("es-CL")}
        </span>
      </td>
      <td className="px-5 py-3 text-right font-medium">
        {formatClp(r.inst.amountClp)}
      </td>
      <td className="px-5 py-3 text-right">
        <form action={markInstallmentPaid}>
          <input type="hidden" name="installmentId" value={r.inst.id} />
          <button className="text-xs font-medium text-brand-600 hover:underline">
            Marcar pagada
          </button>
        </form>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Cobranza</h1>
        <p className="text-sm text-slate-500">
          Crédito directo: cuotas por vencer, vencidas y recaudación.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Recaudado (cuotas)" value={formatClp(totals.recaudado)} />
        <Stat label="Por cobrar" value={formatClp(totals.pendiente)} />
        <Stat label="Vencido" value={formatClp(totals.vencido)} />
      </div>

      <Card>
        <CardHeader
          title={`Cuotas vencidas (${vencidas.length})`}
          subtitle="Prioridad de cobranza."
        />
        {vencidas.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin cuotas vencidas 🎉" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {vencidas.map((r) => (
                  <Row key={r.inst.id} r={r} overdue />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={`Próximas a vencer (${proximas.length})`} />
        {proximas.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin cuotas próximas" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {proximas.map((r) => (
                  <Row key={r.inst.id} r={r} overdue={false} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
