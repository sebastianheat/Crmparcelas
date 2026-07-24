import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  Select,
  Textarea,
} from "@/components/ui";
import { EVENT_LABELS, PARCEL_STATUS } from "@/lib/labels";
import { formatClp, formatPrice } from "@/lib/money";
import { ROLE_LABELS } from "@/lib/roles";
import {
  applyParcelEvent,
  createPaymentPlan,
  generatePromesa,
  markDocumentSigned,
  sendToSignature,
  unmarkInstallmentPaid,
  uploadInstallmentProof,
  replaceInstallmentProof,
} from "@/server/actions";
import { getParcel, listClients, listSellers } from "@/server/queries";

const EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: "reserva", label: "Reserva (ingresa dinero)" },
  { value: "devolucion_reserva", label: "Devolución de reserva" },
  { value: "promesa", label: "Promesa de compraventa (anticipo)" },
  { value: "resciliacion", label: "Resciliación" },
  { value: "nueva_promesa", label: "Nueva promesa" },
  { value: "escritura", label: "Escritura (código de repertorio)" },
  { value: "inscripcion_cbr", label: "Inscripción CBR" },
  { value: "entrega", label: "Entrega" },
  { value: "reparo", label: "Reparo" },
  { value: "vale_vista", label: "Vale vista" },
  { value: "bloqueo", label: "Bloqueo" },
  { value: "desbloqueo", label: "Desbloqueo" },
];

export default async function ParcelPage({
  params,
}: PageProps<"/app/parcelas/[id]">) {
  const { id } = await params;
  const [parcel, clients, sellers] = await Promise.all([
    getParcel(id),
    listClients(),
    listSellers(),
  ]);
  if (!parcel) notFound();

  const ps = PARCEL_STATUS[parcel.status];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              Parcela {parcel.code}
            </h1>
            <Badge tone={ps?.tone}>{ps?.label ?? parcel.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <Link
              href={`/app/proyectos/${parcel.project.slug}`}
              className="hover:text-brand-600"
            >
              {parcel.project.name}
            </Link>{" "}
            · {parcel.areaM2 ? `${parcel.areaM2} m²` : "—"} ·{" "}
            {formatPrice(parcel.price, parcel.priceUnit)}
          </p>
        </div>
        <LinkButton href={`/app/proyectos/${parcel.project.slug}`} variant="ghost">
          ← Proyecto
        </LinkButton>
      </div>

      {/* Cliente de la parcela (reunión 20-07-2026: datos a la vista) */}
      {parcel.currentClient && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-slate-400">Cliente</p>
              <Link
                href={`/app/clientes/${parcel.currentClient.id}`}
                className="text-base font-semibold text-slate-900 hover:text-brand-600"
              >
                {parcel.currentClient.name}
              </Link>
            </div>
            <div>
              <p className="text-xs text-slate-400">RUT</p>
              <p className="font-medium text-slate-700">{parcel.currentClient.rut ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Teléfono</p>
              {parcel.currentClient.phone ? (
                <a href={`tel:${parcel.currentClient.phone}`} className="font-medium text-brand-600 hover:underline">
                  {parcel.currentClient.phone}
                </a>
              ) : (
                <p className="font-medium text-red-500">falta ⚠</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400">Correo</p>
              {parcel.currentClient.email ? (
                <a href={`mailto:${parcel.currentClient.email}`} className="font-medium text-brand-600 hover:underline">
                  {parcel.currentClient.email}
                </a>
              ) : (
                <p className="font-medium text-red-500">falta ⚠</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400">Vendedor</p>
              <p className="font-medium text-slate-700">{parcel.vendedor ?? "—"}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aplicar evento */}
        <Card>
          <CardHeader
            title="Registrar movimiento"
            subtitle="Cada acción queda en el historial inmutable de la parcela."
          />
          <form action={applyParcelEvent} className="space-y-4 p-5">
            <input type="hidden" name="parcelId" value={parcel.id} />
            <Field label="Tipo de movimiento">
              <Select name="type" defaultValue="reserva">
                {EVENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monto ingresado (CLP)" hint="Genera comprobante de dinero">
                <Input name="amountClp" inputMode="numeric" placeholder="300000" />
              </Field>
              <Field label="Cliente">
                <Select name="clientId" defaultValue="">
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label="Vendedor responsable"
              hint="Obligatorio en reservas/promesas con dinero"
            >
              <Select name="sellerId" defaultValue="">
                <option value="">—</option>
                {sellers.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {s.name} · {ROLE_LABELS[s.role]}
                  </option>
                ))}
              </Select>
            </Field>
            <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Forma de pago (opcional — alimenta la promesa)
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Forma de pago de la reserva">
                    <Select name="formaPagoReserva" defaultValue="">
                      <option value="">—</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="cheque">Cheque</option>
                    </Select>
                  </Field>
                  <Field label="Valor total parcela (CLP)">
                    <Input
                      name="valorTotalParcela"
                      inputMode="numeric"
                      defaultValue={parcel.price ?? ""}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Pie (CLP)">
                    <Input name="pieMonto" inputMode="numeric" />
                  </Field>
                  <Field label="Fecha del pie">
                    <Input name="pieFecha" type="date" />
                  </Field>
                  <Field label="Saldo (CLP)">
                    <Input name="saldo" inputMode="numeric" />
                  </Field>
                  <Field label="N° de cuotas">
                    <Input name="nCuotas" inputMode="numeric" placeholder="12" />
                  </Field>
                  <Field label="Valor cuota (CLP)">
                    <Input name="valorCuota" inputMode="numeric" />
                  </Field>
                </div>
                <Field label="Notas de pago">
                  <Input name="notasPago" placeholder="Crédito directo, sin pie, etc." />
                </Field>
              </div>
            </details>
            <Field
              label="Código de repertorio"
              hint="Gatillo de la venta exenta (solo escritura)"
            >
              <Input name="repertorioCode" placeholder="Ej: 1234-2026" />
            </Field>
            <Field label="Nota">
              <Textarea name="note" rows={2} placeholder="Detalle del movimiento…" />
            </Field>
            <Field
              label="Comprobante (foto o PDF, opcional)"
              hint="Queda en el historial, en los documentos de la parcela y en la carpeta del cliente"
            >
              <Input
                name="file"
                type="file"
                accept="application/pdf,image/*"
                className="file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-xs"
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Registrar movimiento</Button>
            </div>
          </form>
        </Card>

        {/* Historial */}
        <Card>
          <CardHeader
            title="Historial"
            subtitle="Append-only: nunca se borra ni se edita."
          />
          <div className="p-5">
            {parcel.events.length === 0 ? (
              <p className="text-sm text-slate-400">Sin movimientos aún.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {parcel.events.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">
                        {EVENT_LABELS[ev.type]}
                      </p>
                      {ev.amountClp && (
                        <span className="text-sm font-medium text-emerald-700">
                          {formatClp(ev.amountClp)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(ev.createdAt).toLocaleString("es-CL")}
                      {ev.client?.name ? ` · ${ev.client.name}` : ""}
                      {ev.repertorioCode ? ` · Rep. ${ev.repertorioCode}` : ""}
                    </p>
                    {ev.note && (
                      <p className="mt-1 text-sm text-slate-600">{ev.note}</p>
                    )}
                    {typeof ev.payload?.comprobanteUrl === "string" && (
                      <a
                        href={ev.payload.comprobanteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
                      >
                        📎 Ver comprobante
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>

      {/* Documentos: promesa generada por IA + repositorio */}
      <Card>
        <CardHeader
          title="Documentos de la parcela"
          subtitle="Genera la promesa de compraventa con los datos del proyecto y del cliente."
          action={
            <form action={generatePromesa}>
              <input type="hidden" name="parcelId" value={parcel.id} />
              <Button type="submit" variant="secondary">
                Generar promesa
              </Button>
            </form>
          }
        />
        <div className="p-5">
          {!parcel.currentClient && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Asigna un cliente (registra una reserva con cliente) para generar la
              promesa.
            </p>
          )}
          {parcel.documents.length === 0 ? (
            <p className="text-sm text-slate-400">Sin documentos aún.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {parcel.documents.map((d) => (
                <li key={d.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-600 hover:underline"
                      >
                        📄 {d.title}
                      </a>
                      {d.docxUrl && (
                        <a
                          href={d.docxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-3 text-sm text-slate-500 hover:underline"
                        >
                          ⬇ Word
                        </a>
                      )}
                      <p className="text-xs text-slate-400">
                        {d.type} · {d.generatedByAi ? "IA · " : ""}
                        {new Date(d.createdAt).toLocaleString("es-CL")}
                      </p>
                    </div>
                    <Badge
                      tone={
                        d.signatureStatus === "firmado"
                          ? "green"
                          : d.signatureStatus === "enviado"
                            ? "amber"
                            : "slate"
                      }
                    >
                      {d.signatureStatus ?? d.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex gap-2">
                    {!d.signatureStatus && (
                      <form action={sendToSignature}>
                        <input type="hidden" name="documentId" value={d.id} />
                        <button className="text-xs font-medium text-brand-600 hover:underline">
                          ✍ Enviar a firma
                        </button>
                      </form>
                    )}
                    {d.signatureStatus === "enviado" && (
                      <form action={markDocumentSigned}>
                        <input type="hidden" name="documentId" value={d.id} />
                        <button className="text-xs font-medium text-emerald-700 hover:underline">
                          ✓ Marcar firmado
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Plan de pago / cobranza (crédito directo) */}
      <Card>
        <CardHeader
          title="Plan de pago"
          subtitle="Crédito directo: pie + cuotas con vencimientos y seguimiento."
        />
        <div className="p-5">
          {!parcel.plan ? (
            <form
              action={createPaymentPlan}
              className="grid items-end gap-4 sm:grid-cols-5"
            >
              <input type="hidden" name="parcelId" value={parcel.id} />
              <Field label="Precio total (CLP)">
                <Input
                  name="totalClp"
                  inputMode="numeric"
                  defaultValue={parcel.price ?? ""}
                />
              </Field>
              <Field label="Pie (CLP)">
                <Input name="pieClp" inputMode="numeric" defaultValue="0" />
              </Field>
              <Field label="N° cuotas">
                <Input name="nCuotas" type="number" min={1} max={240} defaultValue={12} />
              </Field>
              <Field label="1ª cuota">
                <Input name="firstDueDate" type="date" />
              </Field>
              <Button type="submit">Crear plan</Button>
            </form>
          ) : (
            (() => {
              const cuotasPagadas = parcel.installments.filter(
                (c) => c.status === "pagada",
              );
              const pagadoCuotas = cuotasPagadas.reduce(
                (a, c) => a + Number(c.amountClp),
                0,
              );
              const pendiente = parcel.installments
                .filter((c) => c.status === "pendiente")
                .reduce((a, c) => a + Number(c.amountClp), 0);
              const pie = Number(parcel.plan!.pieClp ?? 0);
              const total = Number(parcel.plan!.totalClp ?? 0);
              const pagadoTotal = pie + pagadoCuotas;
              const avance = total > 0 ? Math.round((pagadoTotal / total) * 100) : 0;
              const promesaDoc = parcel.documents.find(
                (d) => d.type === "promesa",
              );
              const conComprobante = parcel.installments.filter(
                (c) => c.proofUrl,
              ).length;
              return (
                <>
                  {/* Resumen del crédito directo */}
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-400">Valor parcela</p>
                      <p className="font-semibold text-slate-900">{formatClp(total)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-400">Pie</p>
                      <p className="font-semibold text-slate-900">{formatClp(pie)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                      <p className="text-xs text-emerald-600">Pagado ({avance}%)</p>
                      <p className="font-semibold text-emerald-700">
                        {formatClp(pagadoTotal)}
                      </p>
                      <p className="text-[11px] text-emerald-600/80">
                        {cuotasPagadas.length}/{parcel.installments.length} cuotas
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                      <p className="text-xs text-amber-600">Saldo pendiente</p>
                      <p className="font-semibold text-amber-700">
                        {formatClp(pendiente)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-400">Promesa</p>
                      {promesaDoc ? (
                        <a
                          href={promesaDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          📄 Ver promesa firmada
                        </a>
                      ) : (
                        <p className="text-sm text-slate-400">Sin promesa aún</p>
                      )}
                      <p className="text-[11px] text-slate-400">
                        {conComprobante}/{parcel.installments.length} con comprobante
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                          <th className="px-3 py-2 font-medium">Cuota</th>
                          <th className="px-3 py-2 font-medium">Vence</th>
                          <th className="px-3 py-2 text-right font-medium">Monto</th>
                          <th className="px-3 py-2 font-medium">Estado</th>
                          <th className="px-3 py-2 font-medium">Comprobante</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {parcel.installments.map((c) => {
                          const overdue = c.overdue;
                          return (
                            <tr key={c.id} className="border-b border-slate-50">
                              <td className="px-3 py-2 font-medium">{c.number}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {new Date(c.dueDate).toLocaleDateString("es-CL")}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatClp(c.amountClp)}
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  tone={
                                    c.status === "pagada"
                                      ? "green"
                                      : overdue
                                        ? "red"
                                        : "amber"
                                  }
                                >
                                  {c.status === "pagada"
                                    ? "Pagada"
                                    : overdue
                                      ? "Vencida"
                                      : "Pendiente"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  {c.status === "pagada" && !c.proofUrl && (
                                    <span className="w-fit rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                      ⚠ falta comprobante
                                    </span>
                                  )}
                                  {c.proofUrl && (
                                    <a
                                      href={c.proofUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-medium text-brand-600 hover:underline"
                                    >
                                      📎 Ver
                                    </a>
                                  )}
                                  <form
                                    action={
                                      c.status === "pagada"
                                        ? replaceInstallmentProof
                                        : uploadInstallmentProof
                                    }
                                    className="flex items-center gap-1"
                                  >
                                    <input
                                      type="hidden"
                                      name="installmentId"
                                      value={c.id}
                                    />
                                    <input
                                      type="file"
                                      name="file"
                                      required
                                      accept="application/pdf,image/*"
                                      className="w-32 text-[10px] text-slate-500 file:mr-1 file:rounded file:border-0 file:bg-brand-50 file:px-1.5 file:py-0.5 file:text-[10px] file:text-brand-700"
                                    />
                                    <button
                                      className="whitespace-nowrap text-xs font-medium text-slate-500 hover:text-brand-600 hover:underline"
                                      title={
                                        c.status === "pagada"
                                          ? c.proofUrl
                                            ? "Reemplazar comprobante"
                                            : "Adjuntar comprobante faltante"
                                          : "Comprobante obligatorio: al subirlo la cuota queda pagada"
                                      }
                                    >
                                      {c.status === "pagada"
                                        ? c.proofUrl
                                          ? "reemplazar"
                                          : "adjuntar"
                                        : "pagar con comprobante"}
                                    </button>
                                  </form>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                {c.status === "pagada" && (
                                  <form action={unmarkInstallmentPaid}>
                                    <input
                                      type="hidden"
                                      name="installmentId"
                                      value={c.id}
                                    />
                                    <button
                                      className="text-xs font-medium text-red-500 hover:underline"
                                      title="Corregir error: vuelve la cuota a pendiente y anula el comprobante de dinero (queda en el historial)"
                                    >
                                      desmarcar
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
                </>
              );
            })()
          )}
        </div>
      </Card>

      {/* Historial de cambios de gestión (auditoría — reunión 20-07-2026) */}
      <Card>
        <CardHeader
          title="Historial de cambios"
          subtitle="Quién hizo qué y cuándo sobre las cuotas y comprobantes de esta parcela."
        />
        <div className="p-5">
          {parcel.audit.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin cambios registrados aún (la auditoría comenzó el 20-07-2026).
            </p>
          ) : (
            <ul className="divide-y divide-slate-50 text-sm">
              {parcel.audit.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="text-slate-700">{a.detail ?? a.action}</p>
                    <p className="text-xs text-slate-400">
                      {a.userName ?? "sistema"} ·{" "}
                      {new Date(a.createdAt).toLocaleString("es-CL")}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    {a.action.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
