import { MockDTEProvider } from "./mock";
import type { DTEProvider } from "./provider";

export * from "./provider";

/** Devuelve el proveedor DTE según la config (env DTE_PROVIDER). */
export function getDteProvider(): DTEProvider {
  const provider = process.env.DTE_PROVIDER ?? "mock";
  switch (provider) {
    case "mock":
      return new MockDTEProvider();
    // TODO(Fase 1+): implementar OpenFactura / LibreDTE / SimpleAPI.
    case "openfactura":
    case "libredte":
    case "simpleapi":
      throw new Error(
        `Proveedor DTE "${provider}" aún no implementado. Usa DTE_PROVIDER=mock.`,
      );
    default:
      return new MockDTEProvider();
  }
}
