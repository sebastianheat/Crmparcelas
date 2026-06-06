import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Stat,
} from "@/components/ui";
import { formatClp, toNumber } from "@/lib/money";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { emitExentInvoice, validateVoucher } from "@/server/actions";
import { getVouchersDetailed } from "@/server/queries";

const VOUCHER_TONE: Record<string, "green" | "amber" | "blue" | "slate"> = {
  registrado: "amber",
  validado: "green",
  facturado: "blue",
  anulado: "slate",
};
const VOUCHER_LABEL: Record<string, string> = {
  registrado: "Pendiente validación",
  validado: "Validado",
  facturado: "Facturado",
  anulado: "Anulado",
};

export default async function PreInvoicingPage() {
  const session = await requireSession();
  const canValidate = can(session.role, "reservas:validate");
  const canEmit = can(session.role, "billing:write");
  const rows = await getVouchersDetailed();

  const activos = rows.filter((r) => r.voucher.status !== "anulado");
  const totalIngresado = activos.reduce(
    (a, r) => a + (toNumber(r.voucher.amountClp) ?? 0),
    0,
  );
  const totalValidado = rows
    .filter((r) => ["validado", "facturado"].includes(r.voucher.status))
    .reduce((a, r) => a + (toNumber(r.voucher.amountClp) ?? 0), 0);
  const pendiente = activos
    .filter((r) => r.voucher.status === "registrado")
    .reduce((a, r) => a + (toNumber(r.voucher.amountClp) ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Prefacturación</h1>
        <p className="text-sm text-slate-500">
          Reserva → validación con comprobante (foto obligatoria) → PDF → factura
          exenta. El orden contable que ningún software del rubro resuelve.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ingresado (registrado)" value={formatClp(totalIngresado)} />
        <Stat label="Validado en cuenta" value={formatClp(totalValidado)} />
        <Stat label="Pendiente de validar" value={formatClp(pendiente)} />
      </div>

      <Card>
        <CardHeader
          title="Comprobantes de dinero"
          subtitle="Finanzas valida cada ingreso adjuntando el depósito/transferencia."
        />
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Sin comprobantes"
              description="Registra una reserva con monto en una parcela y aparecerá aquí."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Folio</th>
                  <th className="px-5 py-3 font-medium">Concepto</th>
                  <th className="px-5 py-3 font-medium">Vendedor</th>
                  <th className="px-5 py-3 text-right font-medium">Monto</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ voucher, projectName, sellerName, validatedByName }) => (
                  <tr
                    key={voucher.id}
                    className="border-b border-slate-50 align-top hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-4 font-mono text-slate-500">
                      #{voucher.folio}
                    </td>
                    <td className="px-5 py-4 text-slate-800">
                      {voucher.concept}
                      <div className="text-xs text-slate-400">{projectName}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {sellerName ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-slate-900">
                      {formatClp(voucher.amountClp)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={VOUCHER_TONE[voucher.status]}>
                        {VOUCHER_LABEL[voucher.status]}
                      </Badge>
                      {voucher.validatedByUserId && (
                        <div className="mt-1 text-xs text-slate-400">
                          por {validatedByName}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {voucher.status === "registrado" &&
                        (canValidate ? (
                          <form
                            action={validateVoucher}
                            className="flex flex-col gap-2"
                          >
                            <input
                              type="hidden"
                              name="voucherId"
                              value={voucher.id}
                            />
                            <input
                              type="file"
                              name="proof"
                              accept="image/*"
                              required
                              className="text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
                            />
                            <Button type="submit" className="w-fit">
                              Validar y generar PDF
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Esperando validación de finanzas
                          </span>
                        ))}

                      {voucher.status !== "registrado" && (
                        <div className="flex flex-col gap-1.5 text-sm">
                          {voucher.pdfUrl && (
                            <a
                              href={voucher.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-brand-600 hover:underline"
                            >
                              📄 PDF de reserva
                            </a>
                          )}
                          {voucher.proofUrl && (
                            <a
                              href={voucher.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:underline"
                            >
                              🖼️ Ver comprobante
                            </a>
                          )}
                          {voucher.status === "validado" && canEmit && (
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
                          )}
                        </div>
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
