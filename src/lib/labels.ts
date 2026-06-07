import type { ParcelEventType } from "@/db/schema";

/** Badge de estado del proyecto → etiqueta + tono visual. */
export const PROJECT_STATUS: Record<
  string,
  { label: string; tone: "green" | "blue" | "amber" | "slate" | "violet" }
> = {
  proximo_lanzamiento: { label: "Próximo Lanzamiento", tone: "slate" },
  en_verde: { label: "En Verde", tone: "amber" },
  etapa: { label: "Etapa", tone: "blue" },
  entrega_inmediata: { label: "Entrega Inmediata", tone: "green" },
  escriturable: { label: "Escriturable", tone: "violet" },
  nuevo: { label: "Nuevo", tone: "blue" },
  vendido_100: { label: "100% Vendido", tone: "slate" },
};

/** Estado de la parcela → etiqueta + tono (verde=disponible, rojo=vendido…). */
export const PARCEL_STATUS: Record<
  string,
  { label: string; tone: "green" | "amber" | "red" | "violet" | "slate" }
> = {
  disponible: { label: "Disponible", tone: "green" },
  reservada: { label: "Reservada", tone: "amber" },
  prometida: { label: "Prometida", tone: "amber" },
  resciliada: { label: "Resciliada", tone: "slate" },
  escriturada: { label: "Escriturada", tone: "violet" },
  inscrita: { label: "Inscrita", tone: "violet" },
  entregada: { label: "Entregada", tone: "red" },
  bloqueada: { label: "Bloqueada", tone: "slate" },
};

export const EVENT_LABELS: Record<ParcelEventType, string> = {
  reserva: "Reserva",
  devolucion_reserva: "Devolución de reserva",
  promesa: "Promesa de compraventa",
  resciliacion: "Resciliación",
  nueva_promesa: "Nueva promesa",
  escritura: "Escritura",
  inscripcion_cbr: "Inscripción CBR",
  entrega: "Entrega",
  reparo: "Reparo",
  vale_vista: "Vale vista",
  bloqueo: "Bloqueo",
  desbloqueo: "Desbloqueo",
  cambio_precio: "Cambio de precio",
};

/** Estado al que pasa la parcela según el evento aplicado. */
export const EVENT_TO_STATUS: Partial<
  Record<ParcelEventType, keyof typeof PARCEL_STATUS>
> = {
  reserva: "reservada",
  devolucion_reserva: "disponible",
  promesa: "prometida",
  nueva_promesa: "prometida",
  resciliacion: "disponible",
  escritura: "escriturada",
  inscripcion_cbr: "inscrita",
  entrega: "entregada",
  bloqueo: "bloqueada",
  desbloqueo: "disponible",
};

export const LEGAL_STATUS: Record<
  string,
  { label: string; tone: "slate" | "amber" | "blue" | "green" }
> = {
  sin_definir: { label: "Sin definir", tone: "slate" },
  sag_ingresado: { label: "Ingresado al SAG", tone: "amber" },
  sag_certificado: { label: "Subdivisión certificada", tone: "blue" },
  en_inscripcion: { label: "En inscripción CBR", tone: "blue" },
  inscrito: { label: "Inscrito / transferible", tone: "green" },
};

export const RIESGO: Record<
  string,
  { label: string; tone: "green" | "amber" | "red" }
> = {
  bajo: { label: "Riesgo bajo", tone: "green" },
  medio: { label: "Riesgo medio", tone: "amber" },
  alto: { label: "Riesgo alto", tone: "red" },
};

// Embudo de ventas — réplica del embudo real de Toscana (13 etapas + perdido).
// Orden = avance en el pipeline.
export const LEAD_STAGES = [
  "entrada",
  "no_contesta_1",
  "no_contesta_2",
  "no_contesta_3",
  "hablando_ia",
  "en_conversacion",
  "reinsistencia",
  "reunion",
  "visita_agendada",
  "visita_cancelada",
  "visita_concretada",
  "reservas",
  "promesando",
  "perdido",
] as const;

// Etapas que cuentan como "ganado" para conversión.
export const LEAD_WON_STAGES = ["reservas", "promesando"];

// Etapas activas (en el embudo, ni ganadas ni perdidas).
export const LEAD_ACTIVE_STAGES = LEAD_STAGES.filter(
  (s) => s !== "perdido" && !["reservas", "promesando"].includes(s),
);

export const LEAD_STAGE: Record<
  string,
  { label: string; tone: "slate" | "blue" | "amber" | "green" | "red" }
> = {
  entrada: { label: "Entrada", tone: "slate" },
  no_contesta_1: { label: "No contesta I", tone: "slate" },
  no_contesta_2: { label: "No contesta II", tone: "slate" },
  no_contesta_3: { label: "No contesta III", tone: "slate" },
  hablando_ia: { label: "Hablando con la IA", tone: "blue" },
  en_conversacion: { label: "En conversación", tone: "blue" },
  reinsistencia: { label: "Re-insistencia", tone: "amber" },
  reunion: { label: "Reunión", tone: "amber" },
  visita_agendada: { label: "Visita agendada", tone: "amber" },
  visita_cancelada: { label: "Visita cancelada", tone: "red" },
  visita_concretada: { label: "Visita concretada", tone: "green" },
  reservas: { label: "Reserva", tone: "green" },
  promesando: { label: "Promesando", tone: "green" },
  perdido: { label: "Perdido", tone: "red" },
};

export const LEAD_SOURCE: Record<string, string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  portal: "Portal inmobiliario",
  referido: "Referido",
  otro: "Otro",
};

export const LEAD_ACTIVITY_TYPE: Record<string, string> = {
  nota: "Nota",
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  email: "Email",
  visita: "Visita",
  cambio_etapa: "Cambio de etapa",
};

export const LEGAL_CASE_TYPE: Record<string, string> = {
  querella: "Querella",
  denuncia: "Denuncia",
  demanda: "Demanda",
  otro: "Otro",
};

export const LEGAL_CASE_STATUS: Record<
  string,
  { label: string; tone: "amber" | "green" | "slate" | "red" }
> = {
  vigente: { label: "Vigente", tone: "amber" },
  concluida: { label: "Concluida", tone: "green" },
  archivada: { label: "Archivada", tone: "slate" },
  no_inicio: { label: "Facultad de no inicio", tone: "slate" },
};

// Tipos de documento del expediente del cliente (checklist).
export const CLIENT_DOC_TYPES: { value: string; label: string; required: boolean }[] = [
  { value: "cedula", label: "Cédula de identidad", required: true },
  { value: "comprobante_pago", label: "Comprobante de pago", required: true },
  { value: "vale_vista", label: "Vale vista", required: false },
  { value: "promesa", label: "Promesa firmada", required: true },
  { value: "escritura", label: "Escritura", required: false },
  { value: "otro", label: "Otro", required: false },
];

export const CLIENT_DOC_LABELS: Record<string, string> = Object.fromEntries(
  CLIENT_DOC_TYPES.map((t) => [t.value, t.label]),
);

export const COST_CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  terreno: "Terreno",
  obras: "Obras",
  legal: "Legal",
  comisiones: "Comisiones",
  operacional: "Operacional",
  otros: "Otros",
};
