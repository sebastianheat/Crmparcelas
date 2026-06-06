import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatClp } from "./money";

/**
 * Renderiza un documento de texto largo (ej. promesa de compraventa) en un PDF
 * A4 multipágina, con encabezado de marca y ajuste de línea por palabras.
 */
export async function renderDocumentPdf(
  title: string,
  body: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 56;
  const size = 10;
  const lineHeight = 14;
  const maxWidth = pageSize[0] - margin * 2;

  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  // Encabezado de marca en la primera página.
  page.drawText("5000", { x: margin, y, size: 20, font: bold, color: BRAND });
  page.drawText("by HEAT", { x: margin + 52, y: y + 3, size: 8, font, color: GRAY });
  y -= 28;

  const drawLine = (text: string, opts?: { bold?: boolean }) => {
    if (y < margin + lineHeight) {
      page = doc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: opts?.bold ? bold : font,
      color: DARK,
    });
    y -= lineHeight;
  };

  const wrap = (text: string) => {
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        drawLine(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) drawLine(line);
  };

  for (const raw of body.split("\n")) {
    const para = raw.trimEnd();
    if (!para) {
      y -= lineHeight * 0.6;
      continue;
    }
    // Encabezados Markdown o cláusulas en mayúscula → negrita.
    const heading = para.replace(/^#+\s*/, "");
    const isHeading =
      /^#{1,6}\s/.test(para) || /^[A-ZÁÉÍÓÚÑ0-9 ".:()\-]{6,}$/.test(para.slice(0, 40));
    if (para.length <= maxWidth / 4 && isHeading) {
      drawLine(heading, { bold: true });
    } else {
      wrap(heading);
    }
  }

  return doc.save();
}

export type ReservaPdfData = {
  tenantName: string;
  folio: number;
  concept: string;
  amountClp: string | number;
  projectName: string;
  parcelCode: string;
  clientName?: string | null;
  sellerName?: string | null;
  validatedByName?: string | null;
  validatedAt?: Date | null;
  proofUrl?: string | null;
};

const BRAND = rgb(0.122, 0.478, 0.302); // #1f7a4d
const DARK = rgb(0.06, 0.09, 0.16);
const GRAY = rgb(0.4, 0.45, 0.5);

/**
 * Genera el PDF del comprobante de reserva, con la foto del comprobante de
 * pago embebida si es JPG/PNG. Devuelve los bytes del PDF.
 */
export async function generateReservaPdf(
  data: ReservaPdfData,
  proof?: { bytes: Uint8Array; type: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // Encabezado
  page.drawText("5000", { x: margin, y: y - 6, size: 28, font: bold, color: BRAND });
  page.drawText("by HEAT", { x: margin + 70, y: y - 2, size: 10, font, color: GRAY });
  page.drawText("COMPROBANTE DE RESERVA", {
    x: width - margin - bold.widthOfTextAtSize("COMPROBANTE DE RESERVA", 12),
    y: y - 4,
    size: 12,
    font: bold,
    color: DARK,
  });
  y -= 26;
  page.drawText(data.tenantName, { x: margin, y, size: 11, font, color: GRAY });
  page.drawText(`Folio N° ${data.folio}`, {
    x: width - margin - font.widthOfTextAtSize(`Folio N° ${data.folio}`, 11),
    y,
    size: 11,
    font,
    color: GRAY,
  });
  y -= 14;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1.5,
    color: BRAND,
  });
  y -= 30;

  const row = (label: string, value: string) => {
    page.drawText(label, { x: margin, y, size: 10, font, color: GRAY });
    page.drawText(value || "—", {
      x: margin + 150,
      y,
      size: 11,
      font: bold,
      color: DARK,
    });
    y -= 24;
  };

  row("Proyecto", data.projectName);
  row("Parcela", data.parcelCode);
  row("Cliente", data.clientName ?? "—");
  row("Vendedor", data.sellerName ?? "—");
  row("Concepto", data.concept);

  // Monto destacado
  y -= 6;
  page.drawRectangle({
    x: margin,
    y: y - 14,
    width: width - margin * 2,
    height: 40,
    color: rgb(0.93, 0.99, 0.95),
  });
  page.drawText("MONTO RESERVA", { x: margin + 12, y: y + 8, size: 9, font, color: GRAY });
  page.drawText(formatClp(data.amountClp), {
    x: margin + 12,
    y: y - 8,
    size: 18,
    font: bold,
    color: BRAND,
  });
  y -= 56;

  // Validación
  page.drawText("Validación de finanzas", {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: DARK,
  });
  y -= 20;
  row("Validado por", data.validatedByName ?? "—");
  row(
    "Fecha validación",
    data.validatedAt ? new Date(data.validatedAt).toLocaleString("es-CL") : "—",
  );

  // Comprobante de pago (imagen embebida)
  if (proof) {
    y -= 10;
    page.drawText("Comprobante de depósito / transferencia:", {
      x: margin,
      y,
      size: 10,
      font,
      color: GRAY,
    });
    y -= 12;
    try {
      const img = proof.type.includes("png")
        ? await doc.embedPng(proof.bytes)
        : await doc.embedJpg(proof.bytes);
      const maxW = width - margin * 2;
      const maxH = y - margin;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: margin, y: y - h, width: w, height: h });
    } catch {
      page.drawText(data.proofUrl ?? "(adjunto no incrustable)", {
        x: margin,
        y: y - 12,
        size: 9,
        font,
        color: BRAND,
      });
    }
  }

  // Pie
  page.drawText(
    "Documento generado por 5000 — venta de parcelas exenta de IVA (DL 3516).",
    { x: margin, y: margin - 20, size: 8, font, color: GRAY },
  );

  return doc.save();
}
