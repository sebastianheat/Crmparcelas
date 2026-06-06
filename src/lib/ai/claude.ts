import Anthropic from "@anthropic-ai/sdk";
import type { Project } from "@/db/schema";

/**
 * Generación de contenido con IA. Requisito de producto: toda la generación de
 * texto usa la API de Anthropic (Claude). Si no hay API key configurada, caemos
 * a una plantilla local para que el MVP funcione sin credenciales.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

const ENTORNO_LABELS: Record<string, string> = {
  cerro: "cerros",
  bosque_nativo: "bosque nativo",
  esclerofilo: "bosque esclerófilo",
  forestal: "entorno forestal",
  lago: "lago",
  rio: "río",
  vinas: "viñas",
};

/**
 * Genera el copy de la landing publicitaria de un proyecto siguiendo el speech
 * de 5 pasos del rubro (§7.3): presentación, ubicación, cercanías, condiciones
 * y cierre con hook de urgencia.
 */
export async function generateLandingCopy(project: Project): Promise<string> {
  const anthropic = client();
  const ctx = projectContext(project);

  if (!anthropic) {
    return fallbackCopy(project, ctx);
  }

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system:
      "Eres un copywriter experto en venta de parcelas de agrado en Chile. " +
      "Escribe en español de Chile, tono profesional y aspiracional, sin exagerar " +
      "ni inventar datos. Sigue el speech de 5 pasos del rubro: presentación, " +
      "ubicación, cercanías, condiciones y cierre con hook de urgencia. " +
      "Devuelve Markdown con un titular potente (precio ancla si existe) y secciones.",
    messages: [
      {
        role: "user",
        content: `Genera el copy de la landing para este proyecto de parcelas:\n\n${ctx}`,
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return text || fallbackCopy(project, ctx);
}

function projectContext(p: Project): string {
  const ubic = [p.comuna, p.provincia, p.region].filter(Boolean).join(", ");
  const entorno = (p.entorno ?? [])
    .map((e) => ENTORNO_LABELS[e] ?? e)
    .join(", ");
  const fact = p.factibilidad ?? {};
  const facts = [
    fact.luz && "luz",
    fact.aguaPotable && "agua potable",
    fact.aguaRegadio && "agua de regadío",
    fact.iluminacionCaminos && "iluminación de caminos",
    fact.portonAutomatico && "portón automático",
  ]
    .filter(Boolean)
    .join(", ");
  const cercanias = (p.cercanias ?? [])
    .map((c) => (c.minutos ? `${c.nombre} (${c.minutos} min)` : c.nombre))
    .join(", ");

  return [
    `Nombre: ${p.name}${p.subBrand ? ` — ${p.subBrand}` : ""}`,
    ubic && `Ubicación: ${ubic}`,
    p.priceFrom &&
      `Precio desde: ${p.priceUnit === "uf" ? "UF " : "$"}${p.priceFrom}`,
    p.accessType && `Acceso: ${p.accessType}`,
    facts && `Factibilidad: ${facts}`,
    entorno && `Entorno: ${entorno}`,
    cercanias && `Cercanías: ${cercanias}`,
    p.description && `Notas: ${p.description}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function fallbackCopy(p: Project, ctx: string): string {
  const ubic = [p.comuna, p.region].filter(Boolean).join(", ");
  return `# ${p.name}${ubic ? ` — ${ubic}` : ""}

> ⚠️ Contenido generado con plantilla local (sin ANTHROPIC_API_KEY).
> Configura la API de Anthropic para generar copy a medida con Claude.

## Invierte en tu parcela de agrado
${p.priceFrom ? `**Desde ${p.priceUnit === "uf" ? "UF " : "$"}${p.priceFrom}.**` : ""}

## El proyecto
${ctx}

## Coordina tu visita
Cupos limitados. Agenda una visita a terreno y asegura tu parcela al mejor precio de lanzamiento.`;
}
