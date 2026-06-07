/**
 * Abstracción de firma electrónica. El spec apunta a FirmaVirtual / Clave Única
 * (Ley 19.799). Programamos contra esta interfaz; en Fase 1 usamos un mock que
 * deja el flujo listo (enviado → firmado) sin proveedor real.
 */
export interface SignatureRequestInput {
  documentUrl: string;
  title: string;
  signers: { name: string; email?: string; rut?: string }[];
}

export interface SignatureResult {
  provider: string;
  ref: string;
  status: "enviado" | "firmado" | "rechazado";
  signUrl?: string;
}

export interface SignatureProvider {
  readonly name: string;
  send(input: SignatureRequestInput): Promise<SignatureResult>;
}

class MockSignatureProvider implements SignatureProvider {
  readonly name = "mock";
  async send(input: SignatureRequestInput): Promise<SignatureResult> {
    const ref = `SIGN-${Date.now().toString(36).toUpperCase()}`;
    return {
      provider: this.name,
      ref,
      status: "enviado",
      signUrl: input.documentUrl,
    };
  }
}

export function getSignatureProvider(): SignatureProvider {
  const provider = process.env.SIGNATURE_PROVIDER ?? "mock";
  switch (provider) {
    case "mock":
      return new MockSignatureProvider();
    // TODO: FirmaVirtual / Clave Única.
    case "firmavirtual":
      throw new Error("Proveedor de firma 'firmavirtual' aún no implementado.");
    default:
      return new MockSignatureProvider();
  }
}
