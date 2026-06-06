/**
 * Abstracción de proveedor DTE (factura electrónica chilena).
 *
 * El spec deja abierto el proveedor concreto (OpenFactura/Haulmer, LibreDTE o
 * SimpleAPI). Programamos contra esta interfaz para poder cambiarlo por config
 * (env DTE_PROVIDER) sin tocar la lógica de negocio. En Fase 1 usamos el mock.
 */

export interface EmitExentInvoiceInput {
  /** RUT del receptor (cliente). */
  receptorRut?: string;
  receptorName?: string;
  /** Monto exento en CLP (la venta de parcelas es exenta de IVA). */
  exemptClp: number;
  concept: string;
  /** Código de repertorio de la escritura: gatillo de la venta (M2/M3). */
  repertorioCode?: string;
}

export interface EmitExentInvoiceResult {
  provider: string;
  trackId: string;
  status: "aceptado" | "pendiente" | "rechazado";
  folio?: number;
  raw?: unknown;
}

export interface DTEProvider {
  readonly name: string;
  emitExentInvoice(
    input: EmitExentInvoiceInput,
  ): Promise<EmitExentInvoiceResult>;
}
