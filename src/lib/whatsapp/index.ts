/**
 * Integración de WhatsApp para el agente IA.
 *
 * Programamos contra la interfaz `WhatsAppProvider`. Tanto Meta Cloud API
 * (directo) como 360dialog hablan esencialmente el mismo Cloud API, así que
 * cambiar de uno a otro es solo URL base + token. Twilio usaría otro adaptador.
 * En Fase 1 usamos `mock` para probar el flujo completo sin proveedor real.
 *
 * Variables de entorno:
 *   WHATSAPP_PROVIDER = mock | cloud | 360dialog
 *   WHATSAPP_TOKEN            (token de Meta o API key de 360dialog)
 *   WHATSAPP_PHONE_NUMBER_ID  (Meta Cloud API)
 *   WHATSAPP_VERIFY_TOKEN     (verificación del webhook)
 */

export interface WhatsAppProvider {
  readonly name: string;
  sendText(to: string, text: string): Promise<{ id: string }>;
}

class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock";
  async sendText(to: string, text: string) {
    console.log(`[whatsapp:mock] → ${to}: ${text}`);
    return { id: `mock-${Date.now().toString(36)}` };
  }
}

/** Meta Cloud API (también sirve para 360dialog cambiando base/headers). */
class CloudWhatsAppProvider implements WhatsAppProvider {
  readonly name: string;
  private base: string;
  private headers: Record<string, string>;

  constructor(kind: "cloud" | "360dialog") {
    this.name = kind;
    const token = process.env.WHATSAPP_TOKEN ?? "";
    if (kind === "360dialog") {
      this.base = "https://waba-v2.360dialog.io";
      this.headers = { "D360-API-KEY": token, "Content-Type": "application/json" };
    } else {
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
      this.base = `https://graph.facebook.com/v21.0/${phoneId}`;
      this.headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
    }
  }

  async sendText(to: string, text: string) {
    const res = await fetch(`${this.base}/messages`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    if (!res.ok) {
      throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { id: data.messages?.[0]?.id ?? "unknown" };
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const provider = process.env.WHATSAPP_PROVIDER ?? "mock";
  switch (provider) {
    case "cloud":
      return new CloudWhatsAppProvider("cloud");
    case "360dialog":
      return new CloudWhatsAppProvider("360dialog");
    default:
      return new MockWhatsAppProvider();
  }
}

/** Extrae los mensajes entrantes de un payload de webhook de Meta Cloud API. */
export function parseInboundCloudWebhook(
  body: unknown,
): { from: string; text: string; phoneNumberId?: string }[] {
  const out: { from: string; text: string; phoneNumberId?: string }[] = [];
  try {
    const entry = (body as { entry?: unknown[] }).entry ?? [];
    for (const e of entry) {
      const changes = (e as { changes?: unknown[] }).changes ?? [];
      for (const c of changes) {
        const value = (c as { value?: Record<string, unknown> }).value ?? {};
        const phoneNumberId = (value.metadata as { phone_number_id?: string })
          ?.phone_number_id;
        const messages = (value.messages as Record<string, unknown>[]) ?? [];
        for (const m of messages) {
          const from = String(m.from ?? "");
          const text = String(
            (m.text as { body?: string })?.body ?? m.type ?? "",
          );
          if (from) out.push({ from, text, phoneNumberId });
        }
      }
    }
  } catch {
    /* payload inesperado */
  }
  return out;
}
