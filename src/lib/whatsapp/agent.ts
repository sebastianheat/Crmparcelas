import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { leadActivities, leads, projects } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { getWhatsAppProvider } from "./index";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

type AgentResult = { reply: string; leadId: string; created: boolean };

/**
 * Procesa un mensaje entrante de WhatsApp para un tenant:
 *  1) busca/crea el lead por teléfono (origen WhatsApp),
 *  2) registra la actividad entrante,
 *  3) genera una respuesta con IA (asistente comercial de parcelas),
 *  4) registra la respuesta y la envía por el proveedor.
 */
export async function handleInboundWhatsApp(params: {
  tenantId: string;
  from: string;
  text: string;
}): Promise<AgentResult> {
  const { tenantId, from, text } = params;

  return withTenant(tenantId, async (tx) => {
    // Catálogo breve de proyectos para que el agente responda con contexto real.
    const projs = await tx
      .select({ name: projects.name, comuna: projects.comuna })
      .from(projects)
      .limit(8);

    let lead = await tx.query.leads.findFirst({
      where: and(eq(leads.phone, from)),
      orderBy: desc(leads.createdAt),
    });
    let created = false;

    if (!lead) {
      const [inserted] = await tx
        .insert(leads)
        .values({
          tenantId,
          name: `WhatsApp ${from}`,
          phone: from,
          source: "whatsapp",
          stage: "entrada",
        })
        .returning();
      lead = inserted;
      created = true;
    }

    // Actividad: mensaje entrante.
    await tx.insert(leadActivities).values({
      tenantId,
      leadId: lead.id,
      type: "whatsapp",
      note: `Entrante: ${text}`,
    });

    const reply = await generateReply(text, projs);

    // Actividad: respuesta del agente.
    await tx.insert(leadActivities).values({
      tenantId,
      leadId: lead.id,
      type: "whatsapp",
      note: `Agente IA: ${reply}`,
    });

    await tx
      .update(leads)
      .set({ lastContactAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, lead.id));

    // Enviar respuesta por el proveedor (mock no-op en Fase 1).
    try {
      await getWhatsAppProvider().sendText(from, reply);
    } catch (e) {
      console.error("[whatsapp] envío falló", e);
    }

    return { reply, leadId: lead.id, created };
  });
}

async function generateReply(
  text: string,
  projs: { name: string; comuna: string | null }[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const catalogo = projs.length
    ? projs.map((p) => `- ${p.name}${p.comuna ? ` (${p.comuna})` : ""}`).join("\n")
    : "(sin proyectos cargados)";

  if (!apiKey) {
    return (
      "¡Hola! Gracias por escribir a 5000 🌿. Soy tu asistente y te ayudo con " +
      "nuestras parcelas. ¿Buscas en alguna comuna en particular y para qué uso " +
      "(inversión, casa de campo)? Con eso te recomiendo el mejor proyecto."
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system:
      // Comportamiento derivado del análisis del agente real de Toscana
      // (ver docs/agente_toscana_analisis.md), corrigiendo sus debilidades.
      "Eres el asistente virtual por WhatsApp de una inmobiliaria de parcelas de " +
      "agrado en Chile (DL 3516). Hablas español de Chile, cálido y cercano, " +
      "breve, con emojis con moderación (👋😊🌿🏡). Tu meta es calificar al lead y " +
      "agendar una VISITA al terreno o una VIDEOLLAMADA con un asesor.\n\n" +
      "Reglas:\n" +
      "- Saluda por su nombre si lo sabes y agradece el interés. Una sola " +
      "pregunta a la vez.\n" +
      "- PRIMERO responde lo que el cliente pregunta; LUEGO avanza al siguiente paso.\n" +
      "- Califica en orden: proyecto/zona de interés → uso (vivir/invertir/ambas) " +
      "→ ahorro disponible → forma de pago.\n" +
      "- Usa SOLO los proyectos y precios del catálogo; nunca inventes valores, " +
      "metrajes ni características. Son terrenos urbanizados (rol propio, agua y " +
      "luz), sin vivienda construida salvo que el catálogo lo diga.\n" +
      "- Cierra siempre proponiendo agendar (visita o videollamada).\n" +
      "- Objeciones: precio → ofrece opciones más económicas del catálogo; " +
      "financiamiento/pie → ofrece agendar con un asesor; 'más info primero' → " +
      "envía la ficha y luego propone agendar.\n" +
      "- Si no tienes un dato, dilo y ofrece derivar a un asesor humano. Nunca " +
      "muestres errores técnicos ni textos en inglés.\n\n" +
      `Catálogo de proyectos:\n${catalogo}`,
    messages: [{ role: "user", content: text }],
  });
  const out = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return out || "¡Hola! ¿En qué comuna y para qué uso buscas tu parcela?";
}
