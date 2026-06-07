/**
 * Conciliación bancaria vía open banking. Programamos contra `BankProvider`;
 * en Fase 1 usamos `mock` y dejamos listo el adaptador de **Fintoc** (Chile).
 *
 * Variables de entorno:
 *   BANK_PROVIDER = mock | fintoc
 *   FINTOC_SECRET_KEY   (sk_live_… / sk_test_…)
 *   FINTOC_LINK_TOKEN   (token del link de la cuenta conectada)
 *   FINTOC_ACCOUNT_ID   (id de la cuenta a sincronizar)
 */

export type BankMovementInput = {
  externalId: string;
  postedAt: Date;
  amountClp: number; // con signo: + abono (entra), − cargo (sale)
  description?: string;
  counterparty?: string;
  raw?: Record<string, unknown>;
};

export interface BankProvider {
  readonly name: string;
  listMovements(opts?: { since?: Date }): Promise<BankMovementInput[]>;
}

class MockBankProvider implements BankProvider {
  readonly name = "mock";
  async listMovements(): Promise<BankMovementInput[]> {
    // Movimientos de ejemplo (abonos) para probar el casado con comprobantes.
    const day = (d: number) => {
      const x = new Date();
      x.setDate(x.getDate() - d);
      return x;
    };
    return [
      {
        externalId: `mock-${day(1).toISOString().slice(0, 10)}-1`,
        postedAt: day(1),
        amountClp: 850000,
        description: "Transferencia recibida",
        counterparty: "Cliente — pago cuota",
      },
      {
        externalId: `mock-${day(2).toISOString().slice(0, 10)}-2`,
        postedAt: day(2),
        amountClp: 1500000,
        description: "Transferencia recibida",
        counterparty: "Reserva parcela",
      },
      {
        externalId: `mock-${day(3).toISOString().slice(0, 10)}-3`,
        postedAt: day(3),
        amountClp: -120000,
        description: "Comisión / gasto bancario",
        counterparty: "Banco",
      },
    ];
  }
}

/** Adaptador Fintoc (open banking Chile). */
class FintocBankProvider implements BankProvider {
  readonly name = "fintoc";
  async listMovements(opts?: { since?: Date }): Promise<BankMovementInput[]> {
    const key = process.env.FINTOC_SECRET_KEY;
    const linkToken = process.env.FINTOC_LINK_TOKEN;
    const accountId = process.env.FINTOC_ACCOUNT_ID;
    if (!key || !linkToken || !accountId) {
      throw new Error(
        "Fintoc no configurado: define FINTOC_SECRET_KEY, FINTOC_LINK_TOKEN y FINTOC_ACCOUNT_ID.",
      );
    }
    const params = new URLSearchParams({ link_token: linkToken, per_page: "100" });
    if (opts?.since) params.set("since", opts.since.toISOString().slice(0, 10));
    const res = await fetch(
      `https://api.fintoc.com/v1/accounts/${accountId}/movements?${params}`,
      { headers: { Authorization: key } },
    );
    if (!res.ok) {
      throw new Error(`Fintoc error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as FintocMovement[];
    return data.map((m) => ({
      externalId: m.id,
      postedAt: new Date(m.post_date ?? m.transaction_date),
      // Fintoc entrega CLP sin decimales (monto en pesos), con signo.
      amountClp: Number(m.amount),
      description: m.description ?? undefined,
      counterparty:
        m.sender_account?.holder_id ?? m.recipient_account?.holder_id ?? undefined,
      raw: m as unknown as Record<string, unknown>,
    }));
  }
}

type FintocMovement = {
  id: string;
  amount: number;
  currency: string;
  post_date?: string;
  transaction_date: string;
  description?: string;
  sender_account?: { holder_id?: string };
  recipient_account?: { holder_id?: string };
};

export function getBankProvider(): BankProvider {
  switch (process.env.BANK_PROVIDER ?? "mock") {
    case "fintoc":
      return new FintocBankProvider();
    default:
      return new MockBankProvider();
  }
}
