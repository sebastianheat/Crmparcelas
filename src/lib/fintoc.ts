/**
 * Cliente de la API pública de Fintoc (https://api.fintoc.com/v1).
 * Auth: header `Authorization: <secret_key>` (sin "Bearer").
 *
 * Cubre lo necesario para finanzas:
 *  - Open banking: cuentas + movimientos (conciliación) y refresh intents.
 *  - Cobros: payment intents (cobrar cuotas vía transferencia chilena).
 *
 * Env: FINTOC_SECRET_KEY, FINTOC_LINK_TOKEN, FINTOC_ACCOUNT_ID, FINTOC_PUBLIC_KEY.
 */
const BASE = process.env.FINTOC_API_BASE ?? "https://api.fintoc.com/v1";

export type FintocMovement = {
  id: string;
  amount: number; // CLP sin decimales, con signo
  currency: string;
  post_date?: string;
  transaction_date: string;
  description?: string;
  reference_id?: string;
  sender_account?: { holder_id?: string; holder_name?: string };
  recipient_account?: { holder_id?: string; holder_name?: string };
};

export type FintocPaymentIntent = {
  id: string;
  status: string; // succeeded | pending | failed | ...
  amount: number;
  currency: string;
  widget_token?: string;
  metadata?: Record<string, string>;
};

function key(): string {
  const k = process.env.FINTOC_SECRET_KEY;
  if (!k) throw new Error("FINTOC_SECRET_KEY no configurada.");
  return k;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  opts: { query?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: key(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Fintoc ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const fintoc = {
  /** Cuentas del link conectado. */
  accounts(linkToken = process.env.FINTOC_LINK_TOKEN ?? "") {
    return call<unknown[]>("GET", "/accounts", { query: { link_token: linkToken } });
  },

  /** Movimientos de una cuenta (paginado simple por per_page + since). */
  async movements(opts?: {
    accountId?: string;
    linkToken?: string;
    since?: string;
    perPage?: number;
  }): Promise<FintocMovement[]> {
    const accountId = opts?.accountId ?? process.env.FINTOC_ACCOUNT_ID ?? "";
    const linkToken = opts?.linkToken ?? process.env.FINTOC_LINK_TOKEN ?? "";
    const query: Record<string, string> = {
      link_token: linkToken,
      per_page: String(opts?.perPage ?? 300),
    };
    if (opts?.since) query.since = opts.since;
    return call<FintocMovement[]>("GET", `/accounts/${accountId}/movements`, { query });
  },

  /** Dispara un refresh de la cuenta; Fintoc avisa por webhook al terminar. */
  refreshIntent(linkToken = process.env.FINTOC_LINK_TOKEN ?? "") {
    return call<{ id: string; status: string }>("POST", "/refresh_intents", {
      body: { link_token: linkToken, async: true },
    });
  },

  /** Crea una intención de pago (cobro por transferencia). */
  createPaymentIntent(input: {
    amountClp: number;
    metadata?: Record<string, string>;
  }) {
    return call<FintocPaymentIntent>("POST", "/payment_intents", {
      body: {
        amount: Math.round(input.amountClp),
        currency: "clp",
        metadata: input.metadata ?? {},
      },
    });
  },

  getPaymentIntent(id: string) {
    return call<FintocPaymentIntent>("GET", `/payment_intents/${id}`);
  },
};
