import Anthropic from "@anthropic-ai/sdk";
import type { Client, Parcel, Project, SellerCompany } from "@/db/schema";
import { formatPrice } from "./money";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export type PromesaInput = {
  project: Project;
  company: SellerCompany | null;
  parcel: Parcel;
  client: Client;
  notaria?: string | null;
  pago?: Record<string, unknown> | null;
};

/** Frase de forma de pago a partir del payload flexible de la reserva. */
function formaPagoTexto(pago?: Record<string, unknown> | null): string {
  if (!pago) return "";
  const fp = (pago.formaPago as Record<string, unknown>) ?? {};
  const parts: string[] = [];
  if (fp.pieMonto) parts.push(`un pie de $${fp.pieMonto}`);
  if (fp.nCuotas && fp.valorCuota)
    parts.push(`${fp.nCuotas} cuotas de $${fp.valorCuota}`);
  if (fp.saldo) parts.push(`un saldo de $${fp.saldo} a la firma de la escritura`);
  if (fp.notas) parts.push(String(fp.notas));
  return parts.join(", ");
}

/** Diccionario plano para rellenar los marcadores {{a.b}} de la matriz. */
function flatData(input: PromesaInput): Record<string, string> {
  const { project, company, parcel, client, notaria, pago } = input;
  const a = project.acquisition ?? {};
  const ciudad = project.comuna || "Santiago";
  const fecha = new Date().toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const d = a.deslindes ?? {};
  return {
    "sociedad.razonSocial": company?.razonSocial ?? "",
    "sociedad.rut": company?.rut ?? "",
    "sociedad.repNombre": company?.repNombre ?? "",
    "sociedad.repCI": company?.repCI ?? "",
    "sociedad.repNacionalidad": company?.repNacionalidad ?? "chileno",
    "sociedad.repEstadoCivil": company?.repEstadoCivil ?? "",
    "sociedad.repProfesion": company?.repProfesion ?? "",
    "sociedad.domicilio": company?.domicilio ?? "",
    "sociedad.personeriaNotaria": company?.personeriaNotaria ?? "",
    "sociedad.personeriaRepertorio": company?.personeriaRepertorio ?? "",
    "sociedad.personeriaFecha": company?.personeriaFecha ?? "",
    "cliente.nombre": client.name ?? "",
    "cliente.rut": client.rut ?? "",
    "cliente.nacionalidad": client.nacionalidad ?? "chilena",
    "cliente.estadoCivil": client.estadoCivil ?? "",
    "cliente.profesion": client.profesion ?? "",
    "cliente.domicilio": client.direccion ?? "",
    "predio.denominacion": a.predioDenominacion ?? "",
    "predio.subdelegacion": a.subdelegacion ?? "",
    "predio.comuna": project.comuna ?? "",
    "predio.provincia": project.provincia ?? "",
    "predio.planoArchivoN": a.planoArchivoN ?? "",
    "predio.planoCbr": a.planoCbr ?? "",
    "predio.planoAnio": a.planoAnio ?? "",
    "predio.superficie": a.superficie ?? "",
    "predio.deslindeNorte": d.norte ?? "",
    "predio.deslindeSur": d.sur ?? "",
    "predio.deslindeOriente": d.oriente ?? "",
    "predio.deslindePoniente": d.poniente ?? "",
    "predio.dominioFojas": a.dominioFojas ?? "",
    "predio.dominioNumero": a.dominioNumero ?? "",
    "predio.dominioAnio": a.dominioAnio ?? "",
    "predio.dominioCbr": a.dominioCbr ?? "",
    "predio.rolSii": a.rolSii ?? "",
    "subdivision.nLotes": a.subdivisionNLotes ?? "",
    "subdivision.fechaSag": a.sagFecha ?? "",
    "subdivision.certSagN": a.sagCertN ?? "",
    "subdivision.archivoCertSag": a.archivoCertSag ?? "",
    "subdivision.archivoRoles": a.archivoRoles ?? "",
    "subdivision.archivoPlano": a.archivoPlano ?? "",
    "parcela.numero": parcel.code ?? "",
    "parcela.superficieM2": parcel.areaM2 ? String(parcel.areaM2) : "",
    "precio.monto": formatPrice(parcel.price, parcel.priceUnit),
    "precio.montoTexto": "",
    "precio.formaPago": formaPagoTexto(pago),
    notaria: notaria ?? "",
    ciudad,
    ciudadFecha: `${ciudad}, a ${fecha}`,
  };
}

/** Reemplazo determinista de marcadores; lo faltante queda marcado para revisión. */
function fillTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = data[key];
    return v && v.trim() ? v : `[POR COMPLETAR: ${key}]`;
  });
}

/**
 * Genera el texto de la promesa.
 *  - Con `template` (matriz del tenant): rellena los marcadores con los datos y,
 *    si hay IA, corrige/redacta lo faltante (ej. forma de pago) SIN alterar las
 *    cláusulas legales. Es el modo recomendado (fidelidad legal del cliente).
 *  - Sin template: la IA redacta un borrador siguiendo la estructura del rubro.
 * SIEMPRE es un BORRADOR para revisión del abogado.
 */
export async function generatePromesaText(
  input: PromesaInput,
  template?: string | null,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (template) {
    const data = flatData(input);
    const filled = fillTemplate(template, data);
    if (!apiKey) return filled;
    // IA corrige/completa lo marcado, respetando las cláusulas de la matriz.
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system:
        "Eres un abogado chileno. Recibes una PROMESA DE COMPRAVENTA de parcela ya " +
        "rellenada desde una matriz. Tu tarea: (1) NO alterar las cláusulas legales ni " +
        "su redacción; (2) redactar con naturalidad las partes marcadas como " +
        "[POR COMPLETAR: ...] SOLO si tienes el dato en el JSON adjunto; (3) si no " +
        "tienes el dato, deja la marca [POR COMPLETAR: ...] para que el abogado la " +
        "complete; (4) redactar correctamente la forma de pago y el monto en palabras " +
        "si es posible. Devuelve únicamente el documento final.",
      messages: [
        {
          role: "user",
          content: `MATRIZ RELLENADA:\n\n${filled}\n\nDATOS (JSON):\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || filled;
  }

  // Sin matriz: borrador asistido por IA (o plantilla local si no hay key).
  const data = flatData(input);
  if (!apiKey) return fillTemplate(FREE_FALLBACK, data);
  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system:
      "Eres un abogado chileno experto en promesas de compraventa de parcelas de " +
      "agrado (DL 3516). Redacta una promesa formal y completa con los datos del JSON. " +
      "No inventes datos faltantes: márcalos como [POR COMPLETAR: ...]. Devuelve solo el contrato.",
    messages: [
      { role: "user", content: JSON.stringify(data, null, 2) },
    ],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || fillTemplate(FREE_FALLBACK, data);
}

const FREE_FALLBACK = `PROMESA DE COMPRAVENTA (BORRADOR)

Promitente vendedora: {{sociedad.razonSocial}} (RUT {{sociedad.rut}}), rep. {{sociedad.repNombre}}.
Promitente compradora: {{cliente.nombre}}, RUT {{cliente.rut}}.

PRIMERO: Inmueble {{predio.denominacion}}, {{predio.comuna}}, sup. {{predio.superficie}}, inscrito a fojas {{predio.dominioFojas}} N° {{predio.dominioNumero}} año {{predio.dominioAnio}} CBR {{predio.dominioCbr}}, Rol {{predio.rolSii}}.
SEGUNDO: Promete vender la Parcela o Lote N° {{parcela.numero}}, sup. aprox. {{parcela.superficieM2}} m².
TERCERO: Precio {{precio.monto}}. Forma de pago: {{precio.formaPago}}.
CUARTO: Prohibición de cambiar el destino (arts. 55 y 56 LGUC). Notaría: {{notaria}}.

[Documento de respaldo sin IA. Use una matriz legal para la versión definitiva.]`;
