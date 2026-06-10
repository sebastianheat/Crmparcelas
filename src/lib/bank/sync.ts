import { desc, eq } from "drizzle-orm";
import { bankMovements } from "@/db/schema";
import type { TenantDb } from "@/db/tenant";
import { getBankProvider } from "./index";

/**
 * Sincroniza los movimientos del banco para un tenant (incremental) y los
 * concilia automáticamente con los comprobantes por monto exacto.
 * Reutilizable desde la acción manual y desde el webhook de Fintoc.
 */
export async function syncBankForTenant(
  tx: TenantDb,
  tenantId: string,
): Promise<{ imported: number; matched: number }> {
  const provider = getBankProvider();

  const last = await tx.query.bankMovements.findFirst({
    orderBy: desc(bankMovements.postedAt),
    columns: { postedAt: true },
  });
  const since = last ? new Date(last.postedAt) : undefined;

  const movements = await provider.listMovements({ since });
  let imported = 0;
  for (const m of movements) {
    const r = await tx
      .insert(bankMovements)
      .values({
        tenantId,
        provider: provider.name,
        externalId: m.externalId,
        postedAt: m.postedAt,
        amountClp: String(m.amountClp),
        description: m.description ?? null,
        counterparty: m.counterparty ?? null,
        raw: m.raw ?? {},
      })
      .onConflictDoNothing({
        target: [bankMovements.tenantId, bankMovements.externalId],
      })
      .returning({ id: bankMovements.id });
    if (r.length) imported++;
  }

  const pendientes = await tx.query.bankMovements.findMany({
    where: eq(bankMovements.status, "pendiente"),
  });
  const vouchers = await tx.query.moneyVouchers.findMany({
    columns: { id: true, amountClp: true },
  });
  const alreadyMatched = new Set(
    (
      await tx.query.bankMovements.findMany({
        columns: { matchedVoucherId: true },
      })
    )
      .map((b) => b.matchedVoucherId)
      .filter(Boolean) as string[],
  );

  let matched = 0;
  for (const mv of pendientes) {
    const amount = Number(mv.amountClp);
    if (amount <= 0) continue;
    const candidates = vouchers.filter(
      (v) => Number(v.amountClp) === amount && !alreadyMatched.has(v.id),
    );
    if (candidates.length === 1) {
      const vid = candidates[0].id;
      await tx
        .update(bankMovements)
        .set({ status: "conciliado", matchedVoucherId: vid, reconciledAt: new Date() })
        .where(eq(bankMovements.id, mv.id));
      alreadyMatched.add(vid);
      matched++;
    }
  }
  return { imported, matched };
}
