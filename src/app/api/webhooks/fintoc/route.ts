import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { paymentIntents } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { payInstallment } from "@/lib/cobranza";

/** Verifica la firma `Fintoc-Signature` (esquema t=…,v1=… tipo Stripe). */
function verify(raw: string, header: string | null): boolean {
  const secret = process.env.FINTOC_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto configurado, no validamos (dev)
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(raw, req.headers.get("fintoc-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const obj = event.data?.object ?? {};
  const type = event.type ?? "";

  if (type === "payment_intent.succeeded") {
    const meta = (obj.metadata as Record<string, string>) ?? {};
    const tenantId = meta.tenantId;
    const installmentId = meta.installmentId;
    const externalId = String(obj.id ?? "");
    if (tenantId) {
      await withTenant(tenantId, async (tx) => {
        await tx
          .update(paymentIntents)
          .set({ status: "succeeded", paidAt: new Date() })
          .where(eq(paymentIntents.externalId, externalId));
        if (installmentId) {
          await payInstallment(tx, tenantId, installmentId, {
            concept: "Pago de cuota (Fintoc)",
          });
        }
      });
    }
  }

  return NextResponse.json({ ok: true });
}
