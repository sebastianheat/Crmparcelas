import Anthropic from "@anthropic-ai/sdk";
import type { Acquisition } from "@/db/schema";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export type ExtractedAcquisition = {
  acquisition: Partial<Acquisition>;
  notaria?: string | null;
  company?: {
    razonSocial?: string;
    rut?: string;
    repNombre?: string;
    repCI?: string;
  } | null;
};

const SCHEMA_HINT = `Devuelve SOLO un objeto JSON válido (sin texto adicional, sin \`\`\`) con esta forma; usa null en lo que no aparezca:
{
  "acquisition": {
    "predioDenominacion": string|null,   // ej. "Resto del Lote A, Hijuela Dos, Fundo La Cruz"
    "subdelegacion": string|null,
    "planoArchivoN": string|null,        // N° de plano archivado en el CBR
    "planoCbr": string|null,             // CBR donde se archivó el plano (ej. Talca)
    "planoAnio": string|null,
    "superficie": string|null,           // ej. "54,50 hectáreas"
    "deslindes": { "norte": string|null, "sur": string|null, "oriente": string|null, "poniente": string|null },
    "dominioFojas": string|null,         // inscripción de dominio: fojas
    "dominioNumero": string|null,        // número
    "dominioAnio": string|null,          // año
    "dominioCbr": string|null,           // Conservador (ej. San Clemente)
    "rolSii": string|null,               // rol de avalúo del predio madre (ej. 455-83)
    "subdivisionNLotes": string|null,
    "sagCertN": string|null,             // certificado SAG (ej. "1511/2023")
    "sagFecha": string|null,
    "archivoCertSag": string|null, "archivoRoles": string|null, "archivoPlano": string|null,
    "aguas": string|null
  },
  "notaria": string|null,
  "company": { "razonSocial": string|null, "rut": string|null, "repNombre": string|null, "repCI": string|null }
}`;

/**
 * Extrae los datos de adquisición de un documento legal (compraventa,
 * inscripción CBR, certificado SAG, etc.) usando Claude con visión de documentos.
 */
export async function extractAcquisition(
  bytes: Uint8Array,
  mediaType: string,
): Promise<ExtractedAcquisition> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY para la extracción automática con IA.",
    );
  }
  const anthropic = new Anthropic({ apiKey });
  const base64 = Buffer.from(bytes).toString("base64");

  const isPdf = mediaType.includes("pdf");
  const isImage = mediaType.startsWith("image/");
  if (!isPdf && !isImage) {
    throw new Error("Formato no soportado para extracción (usa PDF o imagen).");
  }

  const docBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: base64,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: base64,
        },
      };

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      "Eres un asistente legal experto en propiedad raíz chilena (DL 3516). " +
      "Lees documentos de adquisición de parcelaciones (compraventa, inscripción " +
      "del Conservador de Bienes Raíces, certificado SAG, asignación de roles, plano) " +
      "y extraes datos estructurados con precisión. No inventes datos.",
    messages: [
      {
        role: "user",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [docBlock as any, { type: "text", text: SCHEMA_HINT }],
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const json = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(json) as ExtractedAcquisition;
    return parsed;
  } catch {
    throw new Error("La IA no devolvió un JSON válido. Revisa el documento.");
  }
}
