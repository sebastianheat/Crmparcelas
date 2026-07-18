import { Card, CardHeader, EmptyState, LinkButton, Stat } from "@/components/ui";
import { formatClp } from "@/lib/money";
import { getContabilidad, getSiiResumen } from "@/server/queries";

export const metadata = { title: "Contabilidad — 5000" };

const MES_LABEL = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
function mesLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES_LABEL[Number(m)]} ${y}`;
}

export default async function ContabilidadPage() {
  const [{ libro, mensual, ventasSinFecha, totals, costos }, sii] = await Promise.all([
    getContabilidad(),
    getSiiResumen(),
  ]);
  const resultado = totals.anticipos - totals.costos;

  // Agrupar meses por año para subtotales
  const porAnio = new Map<string, typeof mensual>();
  for (const m of mensual) {
    const y = m.mes.slice(0, 4);
    (porAnio.get(y) ?? porAnio.set(y, []).get(y)!).push(m);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Contabilidad</h1>
          <p className="text-sm text-slate-500">
            Ventas prometidas y anticipos de precio. Sin escritura firmada, todo
            pago de cliente es un <strong>anticipo</strong> (adelanto de precio) — la
            venta se devenga al escriturar.
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/api/contabilidad/export?informe=libro" variant="secondary">
            ⬇ Libro de ventas (Excel)
          </LinkButton>
          <LinkButton href="/api/contabilidad/export?informe=mensual" variant="secondary">
            ⬇ Flujo mensual (Excel)
          </LinkButton>
        </div>
      </div>

      {/* Totales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Ventas prometidas"
          value={formatClp(totals.prometido)}
          hint={`${totals.ventas} parcelas (${totals.credito} crédito · ${totals.contado} contado)`}
        />
        <Stat
          label="Anticipos recibidos"
          value={formatClp(totals.anticipos)}
          hint="Reservas, pies y cuotas pagadas"
        />
        <Stat
          label="Por cobrar (cuotas)"
          value={formatClp(totals.porCobrar)}
          hint="Saldo de créditos directos"
        />
        <Stat
          label="Costos"
          value={formatClp(totals.costos)}
          hint="Compra del campo y otros"
        />
        <Stat
          label="Caja neta"
          value={formatClp(resultado)}
          hint="Anticipos − costos"
        />
      </div>

      {/* Balance mensual */}
      <Card>
        <CardHeader
          title="Balance por mes"
          subtitle={`Promesas firmadas y anticipos percibidos por mes. ${
            totals.conFechaPromesa
          }/${totals.ventas} ventas con fecha de promesa verificada desde el documento.`}
        />
        {mensual.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin movimientos aún" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Mes</th>
                  <th className="px-5 py-3 text-right font-medium">Promesas firmadas</th>
                  <th className="px-5 py-3 text-right font-medium">Valor prometido</th>
                  <th className="px-5 py-3 text-right font-medium">Anticipos percibidos</th>
                </tr>
              </thead>
              <tbody>
                {[...porAnio.entries()].map(([anio, meses]) => {
                  const subVentas = meses.reduce((a, m) => a + m.ventasClp, 0);
                  const subAnt = meses.reduce((a, m) => a + m.anticiposClp, 0);
                  const subN = meses.reduce((a, m) => a + m.ventasN, 0);
                  return [
                    ...meses.map((m) => (
                      <tr key={m.mes} className="border-b border-slate-50">
                        <td className="px-5 py-2.5 text-slate-700">{mesLabel(m.mes)}</td>
                        <td className="px-5 py-2.5 text-right text-slate-600">
                          {m.ventasN || "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right text-slate-700">
                          {m.ventasClp ? formatClp(m.ventasClp) : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right font-medium text-emerald-700">
                          {m.anticiposClp ? formatClp(m.anticiposClp) : "—"}
                        </td>
                      </tr>
                    )),
                    <tr key={`sub-${anio}`} className="border-b border-slate-200 bg-slate-50 font-semibold">
                      <td className="px-5 py-2.5 text-slate-900">Total {anio}</td>
                      <td className="px-5 py-2.5 text-right">{subN}</td>
                      <td className="px-5 py-2.5 text-right">{formatClp(subVentas)}</td>
                      <td className="px-5 py-2.5 text-right text-emerald-700">
                        {formatClp(subAnt)}
                      </td>
                    </tr>,
                  ];
                })}
                {ventasSinFecha.n > 0 && (
                  <tr className="bg-amber-50/60 text-amber-800">
                    <td className="px-5 py-2.5">Promesas sin fecha en el documento</td>
                    <td className="px-5 py-2.5 text-right">{ventasSinFecha.n}</td>
                    <td className="px-5 py-2.5 text-right">{formatClp(ventasSinFecha.clp)}</td>
                    <td className="px-5 py-2.5 text-right">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Libro de ventas */}
      <Card>
        <CardHeader
          title={`Libro de ventas prometidas (${libro.length})`}
          subtitle="Una fila por parcela vendida, con el estado del pago. Exportable a Excel."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Lote</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">RUT</th>
                <th className="px-4 py-3 font-medium">F. promesa</th>
                <th className="px-4 py-3 font-medium">Forma</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-right font-medium">Pagado</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {libro.map((v) => (
                <tr key={v.parcelId} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-2">
                    <a
                      href={`/app/parcelas/${v.parcelId}`}
                      className="font-medium text-slate-900 hover:text-brand-600"
                    >
                      {v.code}
                    </a>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2 text-slate-700">
                    {v.clientName}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{v.clientRut || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {v.promesaDate
                      ? new Date(v.promesaDate).toLocaleDateString("es-CL")
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        v.formaPago === "credito"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {v.formaPago === "credito"
                        ? `Crédito ${v.cuotasPagadas}/${v.nCuotas}`
                        : "Contado"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {formatClp(v.valor)}
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-700">
                    {formatClp(v.pagado)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-amber-700">
                    {v.saldo ? formatClp(v.saldo) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td className="px-4 py-3" colSpan={5}>
                  Totales
                </td>
                <td className="px-4 py-3 text-right">{formatClp(totals.prometido)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">
                  {formatClp(totals.anticipos)}
                </td>
                <td className="px-4 py-3 text-right text-amber-700">
                  {formatClp(totals.porCobrar)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Costos */}
      <Card>
        <CardHeader
          title="Costos"
          subtitle="La compra del campo y otros costos cargados. Se administran en la sección Costos."
        />
        {costos.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Sin costos registrados"
              description="Registra la compra del campo en Costos (categoría Terreno) para que el balance quede completo."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {costos.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-slate-800">{c.description ?? c.category}</p>
                  <p className="text-xs text-slate-400">
                    {c.category} · {new Date(c.incurredAt).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <p className="font-medium text-red-600">−{formatClp(c.amountClp)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Situación tributaria SII */}
      {sii && (
        <Card>
          <CardHeader
            title="Situación tributaria (SII)"
            subtitle={`Declaraciones y registros oficiales del SII — ${sii.total} documentos cargados.`}
          />
          <div className="space-y-5 p-5">
            {sii.informe?.anotaciones ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <strong>⚠ Pendiente con el SII:</strong> {String(sii.informe.anotaciones)}
              </div>
            ) : null}
            {Array.isArray(sii.informe?.notas) && sii.informe.notas.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {(sii.informe.notas as string[]).map((n, i) => (
                  <li key={i}>📝 {n}</li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-400">Régimen</p>
                <p className="font-medium text-slate-800">{String(sii.informe?.regimen ?? "—")}</p>
                <p className="text-xs text-slate-400">Inicio actividades: {String(sii.informe?.inicioActividades ?? "—")}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-400">F22 Renta AT2025</p>
                <p className="font-medium text-slate-800">
                  Folio {String((sii.informe?.f22 as Record<string, Record<string, unknown>>)?.at2025?.folio ?? "—")} · IDPC{" "}
                  {formatClp(Number((sii.informe?.f22 as Record<string, Record<string, unknown>>)?.at2025?.idpc ?? 0))}
                </p>
                <p className="text-xs text-slate-400">AT2026: {String((sii.informe?.f22 as Record<string, unknown>)?.at2026 ?? "—")}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-400">Bienes raíces (avalúo fiscal)</p>
                {(sii.informe?.bienesRaices as { rol: string; comuna: string; avaluo: number }[] | undefined)?.map((b) => (
                  <p key={b.rol} className="text-slate-700">
                    {b.comuna} rol {b.rol}: <span className="font-medium">{formatClp(b.avaluo)}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-medium">Período</th>
                    <th className="px-4 py-2 font-medium">F29</th>
                    <th className="px-4 py-2 text-right font-medium">Pago F29</th>
                    <th className="px-4 py-2 text-right font-medium">Ventas RCV (neto+exento)</th>
                    <th className="px-4 py-2 text-right font-medium">Compras RCV (neto)</th>
                  </tr>
                </thead>
                <tbody>
                  {(sii.informe?.f29Pendientes as string[] | undefined)?.map((p) => (
                    <tr key={p} className="border-b border-slate-50 bg-red-50/60 text-red-700">
                      <td className="px-4 py-2 font-medium">{p}</td>
                      <td className="px-4 py-2" colSpan={4}>
                        ✗ NO PRESENTADO — regularizar para evitar bloqueo de DTE
                      </td>
                    </tr>
                  ))}
                  {sii.periodos.map((p) => (
                    <tr key={p.period} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-800">{p.period}</td>
                      <td className="px-4 py-2">
                        {p.f29 ? (
                          <a href={p.f29.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                            ✓ folio {String(p.f29.folio ?? "")}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-700">
                        {p.f29?.pago ? formatClp(Number(p.f29.pago)) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-emerald-700">
                        {p.ventas ? (
                          <a href={p.ventas.url} className="hover:underline" target="_blank" rel="noopener noreferrer">
                            {formatClp(Number(p.ventas.neto ?? 0) + Number(p.ventas.exento ?? 0))}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-700">
                        {p.compras ? (
                          <a href={p.compras.url} className="hover:underline" target="_blank" rel="noopener noreferrer">
                            {formatClp(Number(p.compras.neto ?? 0))}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              {sii.informe && (
                <a href={sii.informe.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">
                  📄 Informe tributario completo
                </a>
              )}
              {sii.otros.map((d) => (
                <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-brand-600 hover:underline">
                  📎 {d.title}
                </a>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
