import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

/**
 * Genera un .docx (Word) a partir de texto plano (ej. promesa de compraventa).
 * Las líneas en mayúscula o con encabezado Markdown se ponen en negrita.
 */
export async function renderDocumentDocx(
  title: string,
  body: string,
): Promise<Uint8Array> {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title, bold: true })],
    }),
    new Paragraph({ text: "" }),
  ];

  for (const raw of body.split("\n")) {
    const line = raw.trimEnd();
    if (!line) {
      paragraphs.push(new Paragraph({ text: "" }));
      continue;
    }
    const clean = line.replace(/^#+\s*/, "");
    const isHeading =
      /^#{1,6}\s/.test(line) ||
      /^[A-ZÁÉÍÓÚÑ0-9 ".:()\-]{6,}:?$/.test(clean.slice(0, 40));
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: clean, bold: isHeading })],
      }),
    );
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}
