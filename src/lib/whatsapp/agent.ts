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
      "Eres el asistente comercial por WhatsApp de una inmobiliaria de parcelas " +
      "de agrado en Chile (DL 3516). Responde breve, cálido y profesional, en " +
      "español de Chile. Califica al lead con 1-2 preguntas (comuna/uso/" +
      "presupuesto), ofrece agendar una visita y menciona proyectos del catálogo " +
      "si calzan. No inventes precios ni proyectos fuera del catálogo.\n\n" +
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
