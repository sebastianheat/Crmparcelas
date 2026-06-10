import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Stat,
} from "@/components/ui";
import { formatClp } from "@/lib/money";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import {
  ignoreMovement,
  reconcileMovement,
  refreshFintoc,
  syncBankMovements,
} from "@/server/actions";
import { getConciliacion } from "@/server/queries";

export default async function ConciliacionPage() {
  const session = await requireSession();
  if (!can(session.role, "finance:read")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="La conciliación bancaria es para finanzas / CEO."
      />
    );
  }
  const canWrite = can(session.role, "finance:write");
  const { rows, vouchers, provider, connected, totals } = await getConciliacion();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Conciliación bancaria
          </h1>
          <p className="text-sm text-slate-500">
            Sincroniza los movimientos del banco (open banking) y cásalos con tus
            comprobantes de dinero.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            {connected && (
              <form action={refreshFintoc}>
                <Button type="submit" variant="secondary">
                  Refrescar (Fintoc)
                </Button>
              </form>
            )}
            <form action={syncBankMovements}>
              <Button type="submit">↻ Sincronizar banco</Button>
            </form>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Badge tone={connected ? "green" : "amber"}>
          {connected ? `Conectado · ${provider}` : "Modo demo (mock)"}
        </Badge>
        {!connected && (
          <span className="text-xs text-slate-500">
            Define <code>BANK_PROVIDER=fintoc</code> +{" "}
            <code>FINTOC_SECRET_KEY</code>, <code>FINTOC_LINK_TOKEN</code> y{" "}
            <code>FINTOC_ACCOUNT_ID</code> para conectar Fintoc.
          </span>
        )}
      </div>

      {!connected && (
        <Card>
          <CardHeader title="Conectar Fintoc (open banking + cobros)" />
          <div className="p-5 text-sm text-slate-600">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Crea tu cuenta en Fintoc y conecta el banco de la empresa (obtienes el <strong>link token</strong> y el <strong>account id</strong>).</li>
              <li>En Vercel define <code>BANK_PROVIDER=fintoc</code>, <code>FINTOC_SECRET_KEY</code>, <code>FINTOC_LINK_TOKEN</code>, <code>FINTOC_ACCOUNT_ID</code> y <code>FINTOC_PUBLIC_KEY</code>.</li>
              <li>
                Configura el <strong>webhook</strong> en Fintoc apuntando a{" "}
                <code className="rounded bg-slate-100 px-1">https://5000.cl/api/webhooks/fintoc</code>{" "}
                y pon el secreto en <code>FINTOC_WEBHOOK_SECRET</code>.
              </li>
              <li>Listo: <strong>Sincronizar</strong> trae movimientos reales, <strong>Refrescar</strong> pide datos al banco, y los <strong>cobros de cuotas</strong> se marcan pagados solos al recibir el pago.</li>
            </ol>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Abonos del período" value={formatClp(totals.abonos)} />
        <Stat label="Conciliado" value={formatClp(totals.conciliado)} />
        <Stat label="Por conciliar" value={formatClp(totals.pendiente)} />
      </div>

      <Card>
        <CardHeader title={`Movimientos (${rows.length})`} />
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Sin movimientos"
              description="Pulsa “Sincronizar banco” para traer los movimientos."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Descripción</th>
                  <th className="px-5 py-3 text-right font-medium">Monto</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ mv, voucherFolio, voucherConcept }) => {
                  const amt = Number(mv.amountClp);
                  const abono = amt > 0;
                  return (
                    <tr key={mv.id} className="border-b border-slate-50">
                      <td className="px-5 py-3 text-slate-600">
                        {new Date(mv.postedAt).toLocaleDateString("es-CL")}
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-slate-700">{mv.description ?? "—"}</div>
                        <div className="text-xs text-slate-400">
                          {mv.counterparty ?? ""}
                        </div>
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-medium ${
                          abono ? "text-emerald-700" : "text-slate-500"
                        }`}
                      >
                        {abono ? "+" : "−"}
                        {formatClp(Math.abs(amt))}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          tone={
                            mv.status === "conciliado"
                              ? "green"
                              : mv.status === "ignorado"
                                ? "slate"
                                : "amber"
                          }
                        >
                          {mv.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {mv.status === "conciliado" && voucherFolio ? (
                          <span className="text-xs text-slate-600">
                            #{voucherFolio} · {voucherConcept}
                          </span>
                        ) : !canWrite ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : abono && mv.status !== "ignorado" ? (
                          <form
                            action={reconcileMovement}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="id" value={mv.id} />
                            <select
                              name="voucherId"
                              defaultValue=""
                              className="max-w-[180px] rounded border border-slate-200 px-1.5 py-1 text-xs"
                            >
                              <option value="">Casar con…</option>
                              {vouchers.map((v) => (
                                <option key={v.id} value={v.id}>
                                  #{v.folio} · {formatClp(v.amountClp)} ·{" "}
                                  {v.concept.slice(0, 24)}
                                </option>
                              ))}
                            </select>
                            <button className="text-xs font-medium text-brand-600 hover:underline">
                              ✓
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                        {canWrite && mv.status !== "ignorado" && (
                          <form action={ignoreMovement} className="mt-1">
                            <input type="hidden" name="id" value={mv.id} />
                            <button className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline">
                              ignorar
                            </button>
                          </form>
                        )}
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
