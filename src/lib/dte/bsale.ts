import type {
  DTEProvider,
  EmitExentInvoiceInput,
  EmitExentInvoiceResult,
} from "./provider";

/**
 * Adaptador Bsale (facturación electrónica certificada en Chile).
 * Emite una FACTURA/BOLETA EXENTA vía la API de documentos de Bsale.
 *
 * Env requeridas:
 *   DTE_PROVIDER=bsale
 *   BSALE_TOKEN           access_token de tu cuenta Bsale
 *   BSALE_DOC_TYPE_ID     id del tipo de documento "factura exenta" en tu cuenta
 *   BSALE_OFFICE_ID       id de la sucursal emisora
 *   BSALE_PRICE_LIST_ID   (opcional) id de lista de precios
 *   BSALE_API_BASE        (opcional) por defecto https://api.bsale.io/v1
 */
export class BsaleDTEProvider implements DTEProvider {
  readonly name = "bsale";
  private base = process.env.BSALE_API_BASE ?? "https://api.bsale.io/v1";

  async emitExentInvoice(
    input: EmitExentInvoiceInput,
  ): Promise<EmitExentInvoiceResult> {
    const token = process.env.BSALE_TOKEN;
    const documentTypeId = Number(process.env.BSALE_DOC_TYPE_ID);
    const officeId = Number(process.env.BSALE_OFFICE_ID);
    if (!token || !documentTypeId || !officeId) {
      throw new Error(
        "Bsale no configurado: define BSALE_TOKEN, BSALE_DOC_TYPE_ID y BSALE_OFFICE_ID.",
      );
    }
    const priceListId = process.env.BSALE_PRICE_LIST_ID
      ? Number(process.env.BSALE_PRICE_LIST_ID)
      : undefined;

    const amount = Math.round(input.exemptClp);
    const body: Record<string, unknown> = {
      documentTypeId,
      officeId,
      priceListId,
      emissionDate: Math.floor(Date.now() / 1000),
      declareSii: 1,
      // Venta de parcela: exenta de IVA → todo el valor va como exento.
      details: [
        {
          comment: input.concept.slice(0, 100),
          quantity: 1,
          netUnitValue: amount,
          taxes: [],
        },
      ],
    };
    if (input.receptorRut) {
      body.client = {
        code: input.receptorRut,
        company: input.receptorName ?? "Cliente",
        // Bsale puede exigir giro/dirección según el tipo de documento.
      };
    }

    const res = await fetch(`${this.base}/documents.json`, {
      method: "POST",
      headers: {
        access_token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      id?: number;
      number?: number;
      urlPdf?: string;
      urlPublicView?: string;
      error?: string;
    };
    if (!res.ok || data.error) {
      return {
        provider: this.name,
        trackId: "",
        status: "rechazado",
        raw: data,
      };
    }
    return {
      provider: this.name,
      trackId: String(data.id ?? ""),
      status: "aceptado",
      folio: data.number,
      raw: data,
    };
  }
}
