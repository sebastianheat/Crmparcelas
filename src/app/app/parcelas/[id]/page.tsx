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
  markInstallmentPaid,
  sendToSignature,
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Cuota</th>
                    <th className="px-3 py-2 font-medium">Vence</th>
                    <th className="px-3 py-2 text-right font-medium">Monto</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
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
                        <td className="px-3 py-2 text-right">
                          {c.status !== "pagada" && (
                            <form action={markInstallmentPaid}>
                              <input
                                type="hidden"
                                name="installmentId"
                                value={c.id}
                              />
                              <button className="text-xs font-medium text-brand-600 hover:underline">
                                Marcar pagada
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
        </div>
      </Card>
    </div>
  );
}
