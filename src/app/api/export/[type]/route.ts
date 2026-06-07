import { csvResponse, toCsv } from "@/lib/csv";
import { LEAD_SOURCE, LEAD_STAGE } from "@/lib/labels";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import {
  getCommissions,
  getConciliacion,
  getInstallmentsExport,
  getVouchersDetailed,
  listLeads,
} from "@/server/queries";

const fmt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("es-CL") : "";
const money = (v: string | number | null) => (v == null ? "0" : String(v));

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const session = await requireSession();
  const { type } = await params;

  // Reportes financieros requieren finanzas; leads, equipo comercial.
  const needsFinance = type !== "leads";
  const perm = needsFinance ? "finance:read" : "reservas:create";
  if (!can(session.role, perm)) {
    return new Response("Sin acceso", { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);

  switch (type) {
    case "cobranza": {
      const rows = await getInstallmentsExport();
      const csv = toCsv(
        ["Proyecto", "Parcela", "Cliente", "Cuota", "Vence", "Monto", "Estado", "Pagada"],
        rows.map((r) => [
          r.projectName,
          r.parcelCode,
          r.clientName,
          r.inst.number,
          fmt(r.inst.dueDate),
          money(r.inst.amountClp),
          r.inst.status,
          fmt(r.inst.paidAt),
        ]),
      );
      return csvResponse(`cobranza-${today}.csv`, csv);
    }
    case "comisiones": {
      const { rows } = await getCommissions();
      const csv = toCsv(
        ["Vendedor", "Rol", "Cobros", "% comisión", "Comisión"],
        rows.map((r) => [r.name, r.role, money(r.cobros), r.pct, money(r.comision)]),
      );
      return csvResponse(`comisiones-${today}.csv`, csv);
    }
    case "comprobantes": {
      const rows = await getVouchersDetailed();
      const csv = toCsv(
        ["Folio", "Fecha", "Proyecto", "Parcela", "Cliente", "Concepto", "Monto", "Estado", "Vendedor"],
        rows.map((r) => [
          r.voucher.folio,
          fmt(r.voucher.issuedAt),
          r.projectName,
          r.parcelCode,
          r.clientName,
          r.voucher.concept,
          money(r.voucher.amountClp),
          r.voucher.status,
          r.sellerName,
        ]),
      );
      return csvResponse(`comprobantes-${today}.csv`, csv);
    }
    case "movimientos": {
      const { rows } = await getConciliacion();
      const csv = toCsv(
        ["Fecha", "Descripción", "Contraparte", "Monto", "Estado", "Comprobante"],
        rows.map((r) => [
          fmt(r.mv.postedAt),
          r.mv.description,
          r.mv.counterparty,
          money(r.mv.amountClp),
          r.mv.status,
          r.voucherFolio ? `#${r.voucherFolio}` : "",
        ]),
      );
      return csvResponse(`movimientos-banco-${today}.csv`, csv);
    }
    case "leads": {
      const { rows } = await listLeads();
      const csv = toCsv(
        ["Nombre", "Teléfono", "Email", "Origen", "Etapa", "Proyecto", "Asignado", "Valor estimado", "Creado"],
        rows.map((r) => [
          r.lead.name,
          r.lead.phone,
          r.lead.email,
          LEAD_SOURCE[r.lead.source] ?? r.lead.source,
          LEAD_STAGE[r.lead.stage]?.label ?? r.lead.stage,
          r.projectName,
          r.assignedName,
          money(r.lead.estimatedValueClp),
          fmt(r.lead.createdAt),
        ]),
      );
      return csvResponse(`leads-${today}.csv`, csv);
    }
    default:
      return new Response("Tipo no soportado", { status: 404 });
  }
}
