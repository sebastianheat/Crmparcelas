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

// Embudo de ventas (orden = avance en el pipeline).
export const LEAD_STAGES = [
  "nuevo",
  "contactado",
  "calificado",
  "visita",
  "negociacion",
  "ganado",
  "perdido",
] as const;

export const LEAD_STAGE: Record<
  string,
  { label: string; tone: "slate" | "blue" | "amber" | "green" | "red" }
> = {
  nuevo: { label: "Nuevo", tone: "slate" },
  contactado: { label: "Contactado", tone: "blue" },
  calificado: { label: "Calificado", tone: "blue" },
  visita: { label: "Visita", tone: "amber" },
  negociacion: { label: "Negociación", tone: "amber" },
  ganado: { label: "Ganado", tone: "green" },
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

export const COST_CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  terreno: "Terreno",
  obras: "Obras",
  legal: "Legal",
  comisiones: "Comisiones",
  operacional: "Operacional",
  otros: "Otros",
};
