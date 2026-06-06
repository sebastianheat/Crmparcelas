/**
 * Utilidades de dinero. Moneda base: CLP (siempre). El precio "Desde" de un
 * proyecto puede expresarse en UF; la conversión a CLP usa el valor UF del día.
 */

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const UF = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formatea un monto en pesos chilenos: 1234567 → "$1.234.567". */
export function formatClp(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return CLP.format(n);
}

/** Formatea un valor en UF: 3490 → "UF 3.490". */
export function formatUf(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return `UF ${UF.format(n)}`;
}

export function formatPrice(
  value: number | string | null | undefined,
  unit: "clp" | "uf",
): string {
  return unit === "uf" ? formatUf(value) : formatClp(value);
}

/** Convierte el tipo `numeric` de Postgres (string) a number, o null. */
export function toNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** IVA chileno (19%). La venta de parcelas es EXENTA, pero el SaaS sí lleva IVA. */
export const IVA_RATE = 0.19;

export function withIva(net: number): { net: number; iva: number; total: number } {
  const iva = Math.round(net * IVA_RATE);
  return { net, iva, total: net + iva };
}
