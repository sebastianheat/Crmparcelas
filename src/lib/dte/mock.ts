import type {
  DTEProvider,
  EmitExentInvoiceInput,
  EmitExentInvoiceResult,
} from "./provider";

/**
 * Proveedor DTE simulado para Fase 1: estructura lista, sin certificado real.
 * Genera un track id y un folio sintéticos y marca la factura como aceptada.
 */
export class MockDTEProvider implements DTEProvider {
  readonly name = "mock";

  async emitExentInvoice(
    input: EmitExentInvoiceInput,
  ): Promise<EmitExentInvoiceResult> {
    const trackId = `MOCK-${Date.now().toString(36).toUpperCase()}`;
    return {
      provider: this.name,
      trackId,
      status: "aceptado",
      folio: Math.floor(100000 + Math.random() * 900000),
      raw: { simulated: true, input },
    };
  }
}
