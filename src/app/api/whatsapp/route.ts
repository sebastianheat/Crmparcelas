import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { handleInboundWhatsApp } from "@/lib/whatsapp/agent";
import { parseInboundCloudWebhook } from "@/lib/whatsapp";

/** Verificación del webhook (Meta hace un GET con hub.challenge). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verify = process.env.WHATSAPP_VERIFY_TOKEN ?? "5000-verify";
  if (mode === "subscribe" && token === verify) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

/** Recepción de mensajes entrantes (Meta Cloud API / 360dialog). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const messages = parseInboundCloudWebhook(body);
  if (messages.length === 0) return NextResponse.json({ ok: true });

  // Resolución de tenant: por ahora, el tenant configurado o el primero.
  // (Multi-número: mapear phone_number_id → tenant cuando se conecten cuentas.)
  const tenantId =
    process.env.WHATSAPP_DEFAULT_TENANT ??
    (await db.query.tenants.findFirst())?.id;
  if (!tenantId) return NextResponse.json({ ok: true });

  for (const m of messages) {
    try {
      await handleInboundWhatsApp({ tenantId, from: m.from, text: m.text });
    } catch (e) {
      console.error("[whatsapp] handler error", e);
    }
  }
  return NextResponse.json({ ok: true });
}
