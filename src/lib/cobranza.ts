import { and, desc, eq, isNotNull, max } from "drizzle-orm";
import { installments, moneyVouchers, parcelEvents, parcels } from "@/db/schema";
import type { TenantDb } from "@/db/tenant";

/**
 * Marca una cuota como pagada, genera el comprobante de dinero (prefactura) y
 * atribuye el vendedor de la venta. Reutilizable desde la acción manual y desde
 * el webhook de Fintoc. Idempotente: si ya está pagada, no hace nada.
 */
export async function payInstallment(
  tx: TenantDb,
  tenantId: string,
  installmentId: string,
  opts: { userId?: string | null; concept?: string } = {},
): Promise<boolean> {
  const inst = await tx.query.installments.findFirst({
    where: eq(installments.id, installmentId),
  });
  if (!inst || inst.status === "pagada") return false;

  const parcel = await tx.query.parcels.findFirst({
    where: eq(parcels.id, inst.parcelId),
    columns: { code: true, projectId: true },
  });
  if (!parcel) return false;

  const sale = await tx.query.parcelEvents.findFirst({
    where: and(
      eq(parcelEvents.parcelId, inst.parcelId),
      isNotNull(parcelEvents.sellerUserId),
    ),
    orderBy: desc(parcelEvents.createdAt),
    columns: { sellerUserId: true },
  });

  const [{ value: lastFolio }] = await tx
    .select({ value: max(moneyVouchers.folio) })
    .from(moneyVouchers);
  const [voucher] = await tx
    .insert(moneyVouchers)
    .values({
      tenantId,
      projectId: parcel.projectId,
      parcelId: inst.parcelId,
      folio: (lastFolio ?? 0) + 1,
      concept: opts.concept ?? `Cuota ${inst.number} parcela ${parcel.code}`,
      amountClp: inst.amountClp,
      sellerUserId: sale?.sellerUserId ?? null,
      createdByUserId: opts.userId ?? null,
    })
    .returning();

  await tx
    .update(installments)
    .set({ status: "pagada", paidAt: new Date(), voucherId: voucher.id })
    .where(eq(installments.id, installmentId));
  return true;
}
