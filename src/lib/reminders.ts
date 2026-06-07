import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { clients, installments, leadActivities, leads, parcels } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { formatClp } from "@/lib/money";
import { getWhatsAppProvider } from "@/lib/whatsapp";

const ACTIVE_STAGES = [
  "nuevo",
  "contactado",
  "calificado",
  "visita",
  "negociacion",
] as const;

const DAY = 86_400_000;

/**
 * Genera recordatorios para un tenant:
 *  - Cobranza: cuotas pendientes que vencen en ≤3 días (o ya vencidas) sin
 *    recordatorio previo → mensaje de WhatsApp al cliente.
 *  - Leads: leads en etapa activa sin contacto hace >3 días → nota de
 *    seguimiento en su ficha. Usa `reminderSentAt` para no repetir.
 */
export async function runRemindersForTenant(
  tenantId: string,
): Promise<{ cobranza: number; leads: number }> {
  return withTenant(tenantId, async (tx) => {
    const now = Date.now();
    const wa = getWhatsAppProvider();

    // ── Cobranza ──
    const dueThreshold = new Date(now + 3 * DAY);
    const cuotas = await tx
      .select({
        id: installments.id,
        number: installments.number,
        amountClp: installments.amountClp,
        dueDate: installments.dueDate,
        phone: clients.phone,
        clientName: clients.name,
      })
      .from(installments)
      .leftJoin(parcels, eq(installments.parcelId, parcels.id))
      .leftJoin(clients, eq(parcels.currentClientId, clients.id))
      .where(
        and(
          eq(installments.status, "pendiente"),
          isNull(installments.reminderSentAt),
          lte(installments.dueDate, dueThreshold),
        ),
      );

    let cobranza = 0;
    for (const c of cuotas) {
      const venc = new Date(c.dueDate);
      if (c.phone) {
        const vencida = venc.getTime() < now;
        const fecha = venc.toLocaleDateString("es-CL");
        const msg = vencida
          ? `Hola ${c.clientName ?? ""}, tu cuota ${c.number} por ${formatClp(c.amountClp)} venció el ${fecha}. Por favor regulariza tu pago. — 5000`
          : `Hola ${c.clientName ?? ""}, te recordamos tu cuota ${c.number} por ${formatClp(c.amountClp)} con vencimiento el ${fecha}. — 5000`;
        try {
          await wa.sendText(c.phone, msg);
          cobranza++;
        } catch {
          /* no romper el lote por un envío */
        }
      }
      await tx
        .update(installments)
        .set({ reminderSentAt: new Date() })
        .where(eq(installments.id, c.id));
    }

    // ── Leads sin seguimiento ──
    const activos = await tx
      .select()
      .from(leads)
      .where(inArray(leads.stage, [...ACTIVE_STAGES]));

    let leadsCount = 0;
    for (const l of activos) {
      const ref = (l.lastContactAt ?? l.createdAt).getTime();
      const stale = now - ref > 3 * DAY;
      const alreadyReminded =
        l.reminderSentAt != null && l.reminderSentAt.getTime() >= ref;
      if (!stale || alreadyReminded) continue;
      const days = Math.floor((now - ref) / DAY);
      await tx.insert(leadActivities).values({
        tenantId,
        leadId: l.id,
        type: "nota",
        note: `⏰ Recordatorio: lead sin contacto hace ${days} días.`,
      });
      await tx
        .update(leads)
        .set({ reminderSentAt: new Date() })
        .where(eq(leads.id, l.id));
      leadsCount++;
    }

    return { cobranza, leads: leadsCount };
  });
}
