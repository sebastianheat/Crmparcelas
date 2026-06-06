import Anthropic from "@anthropic-ai/sdk";
import type {
  Client,
  Parcel,
  Project,
  SellerCompany,
} from "@/db/schema";
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

/**
 * Genera el texto de la promesa de compraventa de una parcela siguiendo la
 * estructura real del rubro (ver docs/Proceso_Legal_Parcelas.md): comparecencia,
 * inmueble (predio madre), subdivisión SAG, objeto (lote), precio/forma de pago,
 * estado ad-corpus + prohibición de cambio de destino (arts. 55-56 LGUC), plazo,
 * multa, entrega, cesión, instrucciones notariales del vale vista, personería.
 *
 * Usa la API de Anthropic (requisito de producto). Si no hay key, devuelve un
 * borrador con plantilla local. SIEMPRE es un BORRADOR para revisión del abogado.
 */
export async function generatePromesaText(input: PromesaInput): Promise<string> {
  const data = buildContext(input);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackPromesa(input, data);

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system:
      "Eres un abogado chileno experto en promesas de compraventa de parcelas de " +
      "agrado (DL 3516). Redacta una PROMESA DE COMPRAVENTA formal, en español de " +
      "Chile, lista para revisión, a partir de los datos entregados. Estructura con " +
      "cláusulas: comparecencia (promitente vendedora = sociedad con su representante " +
      "y personería; promitente compradora = cliente); PRIMERO Inmueble (predio madre: " +
      "denominación, ubicación, plano archivado, superficie, deslindes N/S/O/P, " +
      "inscripción fojas/número/año y CBR, rol SII); SEGUNDO Subdivisión (N° lotes, " +
      "plano aprobado SAG, certificado, archivos CBR); objeto (la Parcela o Lote N° y " +
      "su superficie en m²); precio y forma de pago (UF/CLP, pie/cuotas/saldo, vale " +
      "vista en custodia notarial); estado ad-corpus y prohibición de cambiar el " +
      "destino (arts. 55 y 56 LGUC); plazo y condición; multa; entrega tras inscripción " +
      "CBR; cesión; instrucciones notariales del vale vista; personería. " +
      "NO inventes datos que falten: si un dato no viene, deja una marca clara como " +
      "«[POR COMPLETAR: …]». Devuelve solo el texto del contrato, sin comentarios.",
    messages: [
      {
        role: "user",
        content: `Redacta la promesa con estos datos (JSON):\n\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || fallbackPromesa(input, data);
}

function buildContext(input: PromesaInput) {
  const { project, company, parcel, client, notaria, pago } = input;
  const a = project.acquisition ?? {};
  return {
    promitente_vendedora: company
      ? {
          razonSocial: company.razonSocial,
          rut: company.rut,
          representante: company.repNombre,
          repCI: company.repCI,
          repNacionalidad: company.repNacionalidad,
          repEstadoCivil: company.repEstadoCivil,
          repProfesion: company.repProfesion,
          domicilio: company.domicilio,
          personeria: {
            notaria: company.personeriaNotaria,
            repertorio: company.personeriaRepertorio,
            fecha: company.personeriaFecha,
          },
        }
      : null,
    promitente_compradora: {
      nombre: client.name,
      rut: client.rut,
      nacionalidad: client.nacionalidad,
      estadoCivil: client.estadoCivil,
      profesion: client.profesion,
      domicilio: client.direccion,
      email: client.email,
    },
    inmueble_predio_madre: {
      denominacion: a.predioDenominacion,
      subdelegacion: a.subdelegacion,
      ubicacion: [project.comuna, project.provincia, project.region]
        .filter(Boolean)
        .join(", "),
      planoArchivoN: a.planoArchivoN,
      planoCbr: a.planoCbr,
      planoAnio: a.planoAnio,
      superficie: a.superficie,
      deslindes: a.deslindes,
      dominio: {
        fojas: a.dominioFojas,
        numero: a.dominioNumero,
        anio: a.dominioAnio,
        cbr: a.dominioCbr,
      },
      rolSii: a.rolSii,
      aguas: a.aguas,
    },
    subdivision: {
      nLotes: a.subdivisionNLotes,
      certSag: a.sagCertN,
      fechaSag: a.sagFecha,
      archivoCertSag: a.archivoCertSag,
      archivoRoles: a.archivoRoles,
      archivoPlano: a.archivoPlano,
    },
    objeto_lote: {
      numero: parcel.code,
      rolPrerrol: parcel.rol ?? parcel.prerrol,
      superficieM2: parcel.areaM2,
      deslindes: parcel.deslindes,
    },
    precio: {
      monto: parcel.price,
      unidad: parcel.priceUnit,
      formaPago: pago ?? null,
    },
    notaria: notaria ?? null,
    proyecto: project.name,
  };
}

function fallbackPromesa(input: PromesaInput, data: ReturnType<typeof buildContext>) {
  const { project, company, parcel, client } = input;
  const c = (v: unknown) => (v ? String(v) : "[POR COMPLETAR]");
  const precio = formatPrice(parcel.price, parcel.priceUnit);
  return `PROMESA DE COMPRAVENTA (BORRADOR)

⚠️ Generado con plantilla local (sin ANTHROPIC_API_KEY). Revisar con abogado.

${c(company?.razonSocial)} A ${c(client.name)}

COMPARECENCIA. Comparecen, por una parte, ${c(company?.razonSocial)}, RUT ${c(
    company?.rut,
  )}, representada por ${c(company?.repNombre)}, cédula ${c(
    company?.repCI,
  )}, domiciliada en ${c(company?.domicilio)} ("promitente vendedora"); y por la otra, ${c(
    client.name,
  )}, RUT ${c(client.rut)}, ${c(client.nacionalidad)}, ${c(
    client.estadoCivil,
  )}, ${c(client.profesion)}, domiciliado en ${c(client.direccion)} ("promitente compradora").

PRIMERO: Inmueble. El predio madre denominado ${c(
    data.inmueble_predio_madre.denominacion,
  )}, ubicado en ${c(data.inmueble_predio_madre.ubicacion)}, superficie ${c(
    data.inmueble_predio_madre.superficie,
  )}, inscrito a fojas ${c(data.inmueble_predio_madre.dominio.fojas)} N° ${c(
    data.inmueble_predio_madre.dominio.numero,
  )} del Registro de Propiedad del CBR de ${c(
    data.inmueble_predio_madre.dominio.cbr,
  )} año ${c(data.inmueble_predio_madre.dominio.anio)}, Rol SII ${c(
    data.inmueble_predio_madre.rolSii,
  )}. Deslindes — Norte: ${c(data.inmueble_predio_madre.deslindes?.norte)}; Sur: ${c(
    data.inmueble_predio_madre.deslindes?.sur,
  )}; Oriente: ${c(data.inmueble_predio_madre.deslindes?.oriente)}; Poniente: ${c(
    data.inmueble_predio_madre.deslindes?.poniente,
  )}.

SEGUNDO: Subdivisión. Subdividido en ${c(
    data.subdivision.nLotes,
  )} lotes según plano aprobado por el SAG, Certificado N° ${c(
    data.subdivision.certSag,
  )}.

TERCERO: Objeto. La promitente vendedora promete vender a la promitente compradora la PARCELA O LOTE N° ${c(
    parcel.code,
  )}, de superficie aproximada ${c(parcel.areaM2)} m².

CUARTO: Precio. El precio es ${precio}, pagadero según la forma de pago acordada${
    data.precio.formaPago ? `: ${JSON.stringify(data.precio.formaPago)}` : " [POR COMPLETAR]"
  }, mediante vale vista en custodia notarial.

QUINTO: La venta es como especie o cuerpo cierto. La promitente compradora declara conocer y aceptar la prohibición de cambiar el destino de la parcela (arts. 55 y 56 LGUC).

SEXTO: Plazo y entrega. El contrato prometido se otorgará en la notaría ${c(
    input.notaria,
  )} dentro del plazo acordado; la entrega se efectúa una vez inscrita la parcela a nombre del comprador en el CBR.

[Cláusulas de multa, cesión e instrucciones notariales del vale vista por completar según matriz.]

Proyecto: ${project.name}.`;
}
