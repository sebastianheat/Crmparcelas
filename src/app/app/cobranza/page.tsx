import Link from "next/link";
import { Fragment } from "react";
import { Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { formatClp } from "@/lib/money";
import {
  createCuotaPaymentLink,
  uploadInstallmentProof,
} from "@/server/actions";
import { getCobranza } from "@/server/queries";

export default async function CobranzaPage() {
  const { totals, vencidas, proximas } = await getCobranza();
  const fintoc = (process.env.BANK_PROVIDER ?? "mock") === "fintoc";

  type Fila = Awaited<ReturnType<typeof getCobranza>>["vencidas"][number];

  // Vencidas agrupadas por parcela (cliente). El query viene ordenado por
  // fecha, así que los grupos quedan por deuda más antigua primero y dentro
  // de cada grupo las cuotas van en orden de vencimiento.
  const grupos = new Map<string, Fila[]>();
  for (const r of vencidas) {
    const key = r.inst.parcelId ?? r.inst.id;
    const g = grupos.get(key);
    if (g) g.push(r);
    else grupos.set(key, [r]);
  }
  const sumaGrupo = (filas: Fila[]) =>
    filas.reduce((a, f) => a + Number(f.inst.amountClp), 0);

  const Row = ({
    r,
    overdue,
  }: {
    r: Fila;
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
        <div className="flex items-center justify-end gap-3">
          {fintoc && (
            <form action={createCuotaPaymentLink}>
              <input type="hidden" name="installmentId" value={r.inst.id} />
              <button className="text-xs font-medium text-slate-500 hover:text-brand-600 hover:underline">
                Cobrar (Fintoc)
              </button>
            </form>
          )}
          {r.inst.proofUrl && (
            <a
              href={r.inst.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-brand-600"
              title="Ver comprobante"
            >
              📎
            </a>
          )}
          <form action={uploadInstallmentProof} className="flex items-center gap-1">
            <input type="hidden" name="installmentId" value={r.inst.id} />
            <input
              type="file"
              name="file"
              required
              className="w-28 text-[10px] text-slate-500 file:mr-1 file:rounded file:border-0 file:bg-brand-50 file:px-1.5 file:py-0.5 file:text-[10px] file:text-brand-700"
            />
            <button className="text-xs font-medium text-slate-500 hover:text-brand-600 hover:underline">
              pagar con comprobante
            </button>
          </form>

        </div>
      </td>
    </tr>
  );

  // Fila compacta para el listado agrupado (la parcela/cliente va en el
  // encabezado del grupo, no se repite en cada cuota).
  const RowCuota = ({ r }: { r: Fila }) => (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60">
      <td className="py-3 pl-10 pr-5 text-slate-600">Cuota {r.inst.number}</td>
      <td className="px-5 py-3 text-red-600">
        {new Date(r.inst.dueDate).toLocaleDateString("es-CL")}
      </td>
      <td className="px-5 py-3 text-right font-medium">
        {formatClp(r.inst.amountClp)}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          {fintoc && (
            <form action={createCuotaPaymentLink}>
              <input type="hidden" name="installmentId" value={r.inst.id} />
              <button className="text-xs font-medium text-slate-500 hover:text-brand-600 hover:underline">
                Cobrar (Fintoc)
              </button>
            </form>
          )}
          {r.inst.proofUrl && (
            <a
              href={r.inst.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-brand-600"
              title="Ver comprobante"
            >
              📎
            </a>
          )}
          <form action={uploadInstallmentProof} className="flex items-center gap-1">
            <input type="hidden" name="installmentId" value={r.inst.id} />
            <input
              type="file"
              name="file"
              required
              className="w-28 text-[10px] text-slate-500 file:mr-1 file:rounded file:border-0 file:bg-brand-50 file:px-1.5 file:py-0.5 file:text-[10px] file:text-brand-700"
            />
            <button className="text-xs font-medium text-slate-500 hover:text-brand-600 hover:underline">
              pagar con comprobante
            </button>
          </form>

        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app" className="text-sm text-slate-400 hover:underline">
          ← Volver al dashboard
        </Link>
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
          subtitle={`Agrupadas por cliente/parcela (${grupos.size} clientes con deuda), de la más antigua a la más reciente.`}
        />
        {vencidas.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin cuotas vencidas 🎉" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {[...grupos.values()].map((filas) => {
                  const g = filas[0];
                  return (
                    <Fragment key={g.inst.parcelId ?? g.inst.id}>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        <td colSpan={3} className="px-5 py-2.5">
                          <span className="font-semibold text-slate-900">
                            {g.clientName ?? "Sin cliente"}
                          </span>
                          {g.parcelCode && (
                            <Link
                              href={`/app/parcelas/${g.inst.parcelId}`}
                              className="ml-2 text-xs font-medium text-brand-600 hover:underline"
                            >
                              {g.projectName} · {g.parcelCode}
                            </Link>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs font-semibold text-red-600">
                          {filas.length} cuota{filas.length > 1 ? "s" : ""} ·{" "}
                          {formatClp(sumaGrupo(filas))}
                        </td>
                      </tr>
                      {filas.map((r) => (
                        <RowCuota key={r.inst.id} r={r} />
                      ))}
                    </Fragment>
                  );
                })}
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
