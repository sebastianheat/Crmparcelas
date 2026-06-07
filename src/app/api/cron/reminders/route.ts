import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { runRemindersForTenant } from "@/lib/reminders";

/**
 * Cron diario (Vercel Cron) que genera recordatorios para todos los tenants.
 * Protegido con CRON_SECRET (Vercel envía Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("forbidden", { status: 403 });
    }
  }

  const tenants = await db.query.tenants.findMany({ columns: { id: true } });
  let cobranza = 0;
  let leads = 0;
  for (const t of tenants) {
    try {
      const r = await runRemindersForTenant(t.id);
      cobranza += r.cobranza;
      leads += r.leads;
    } catch (e) {
      console.error("[cron:reminders] tenant error", t.id, e);
    }
  }
  return NextResponse.json({ ok: true, tenants: tenants.length, cobranza, leads });
}
