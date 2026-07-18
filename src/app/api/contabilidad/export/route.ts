import { getContabilidad } from "@/server/queries";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Exporta el informe de contabilidad en CSV compatible con Excel (Chile):
 * separador ';', BOM UTF-8 y montos sin separador de miles.
 *  ?informe=libro   → libro de ventas prometidas (por parcela/cliente)
 *  ?informe=mensual → balance por mes (promesas + anticipos)
 */
export async function GET(req: Request) {
  await requirePermission("finance:read");
  const url = new URL(req.url);
  const informe = url.searchParams.get("informe") ?? "libro";
  const { libro, mensual, ventasSinFecha, totals, costos } = await getContabilidad();

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = (cells: unknown[]) => cells.map(esc).join(";");
  const fecha = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString("es-CL") : "";

  let lines: string[] = [];
  let filename = "contabilidad.csv";

  if (informe === "mensual") {
    filename = "balance_mensual_5000.csv";
    lines = [
      row(["Mes", "Promesas firmadas", "Valor prometido (CLP)", "Anticipos percibidos (CLP)"]),
      ...mensual.map((m) => row([m.mes, m.ventasN, m.ventasClp, m.anticiposClp])),
    ];
    if (ventasSinFecha.n > 0) {
      lines.push(row(["Sin fecha de promesa", ventasSinFecha.n, ventasSinFecha.clp, ""]));
    }
    lines.push("");
    lines.push(row(["TOTAL PROMETIDO", "", totals.prometido, ""]));
    lines.push(row(["TOTAL ANTICIPOS", "", "", totals.anticipos]));
    lines.push(row(["TOTAL COSTOS", "", "", -totals.costos]));
    lines.push(row(["CAJA NETA (anticipos - costos)", "", "", totals.anticipos - totals.costos]));
  } else {
    filename = "libro_ventas_prometidas_5000.csv";
    lines = [
      row([
        "Lote", "Proyecto", "Cliente", "RUT", "Fecha promesa", "Forma de pago",
        "Valor promesa (CLP)", "Pie (CLP)", "Pagado a la fecha (CLP)",
        "Saldo por cobrar (CLP)", "Cuotas pagadas", "Cuotas totales",
      ]),
      ...libro.map((v) =>
        row([
          v.code, v.projectName, v.clientName, v.clientRut, fecha(v.promesaDate),
          v.formaPago === "credito" ? "Crédito directo" : "Contado",
          v.valor, v.pie, v.pagado, v.saldo, v.cuotasPagadas, v.nCuotas,
        ]),
      ),
      "",
      row(["TOTALES", "", "", "", "", "", totals.prometido, "", totals.anticipos, totals.porCobrar, "", ""]),
      "",
      row(["COSTOS"]),
      ...costos.map((c) => row([c.description ?? c.category, "", "", "", fecha(c.incurredAt), c.category, -c.amountClp])),
      row(["TOTAL COSTOS", "", "", "", "", "", -totals.costos]),
    ];
  }

  // BOM para que Excel abra el UTF-8 con tildes correctas.
  const body = "﻿" + lines.join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
