import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Stat,
} from "@/components/ui";
import { formatClp, toNumber } from "@/lib/money";
import { emitExentInvoice } from "@/server/actions";
import { getVouchersDetailed } from "@/server/queries";

const VOUCHER_TONE: Record<string, "green" | "amber" | "slate"> = {
  registrado: "amber",
  facturado: "green",
  anulado: "slate",
};

const VOUCHER_LABEL: Record<string, string> = {
  registrado: "Registrado",
  facturado: "Facturado",
  anulado: "Anulado",
};

export default async function PreInvoicingPage() {
  const rows = await getVouchersDetailed();

  const totalIngresado = rows
    .filter((r) => r.voucher.status !== "anulado")
    .reduce((acc, r) => acc + (toNumber(r.voucher.amountClp) ?? 0), 0);
  const totalFacturado = rows
    .filter((r) => r.voucher.status === "facturado")
    .reduce((acc, r) => acc + (toNumber(r.voucher.amountClp) ?? 0), 0);
  const pendiente = totalIngresado - totalFacturado;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Prefacturación</h1>
        <p className="text-sm text-slate-500">
          Comprobante de dinero → factura exenta. El orden contable que ningún
          software del rubro resuelve.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ingresado (comprobantes)" value={formatClp(totalIngresado)} />
        <Stat label="Facturado (exenta)" value={formatClp(totalFacturado)} />
        <Stat label="Pendiente de facturar" value={formatClp(pendiente)} />
      </div>

      <Card>
        <CardHeader
          title="Comprobantes de dinero"
          subtitle="Cada anticipo de reserva/promesa genera un comprobante trazable."
        />
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Sin comprobantes"
              description="Registra una reserva o promesa con monto en una parcela y aparecerá aquí."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Folio</th>
                  <th className="px-5 py-3 font-medium">Concepto</th>
                  <th className="px-5 py-3 font-medium">Proyecto</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 text-right font-medium">Monto</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ voucher, projectName, parcelCode, clientName }) => (
                  <tr
                    key={voucher.id}
                    className="border-b border-slate-50 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3 font-mono text-slate-500">
                      #{voucher.folio}
                    </td>
                    <td className="px-5 py-3 text-slate-800">
                      {voucher.concept}
                      {parcelCode && (
                        <span className="text-slate-400"> · {parcelCode}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {projectName ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {clientName ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatClp(voucher.amountClp)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={VOUCHER_TONE[voucher.status]}>
                        {VOUCHER_LABEL[voucher.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {voucher.status === "registrado" ? (
                        <form action={emitExentInvoice}>
                          <input
                            type="hidden"
                            name="voucherId"
                            value={voucher.id}
                          />
                          <Button variant="secondary" type="submit">
                            Emitir factura exenta
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
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
