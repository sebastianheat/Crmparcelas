"use client";

import { useState } from "react";
import { createPortalCuotaPayment } from "@/server/actions";

type FintocWidget = { open: () => void };
type FintocSDK = {
  create: (opts: {
    publicKey: string;
    widgetToken: string;
    holderType: string;
    product: string;
    onSuccess?: () => void;
    onExit?: () => void;
  }) => FintocWidget;
};
declare global {
  interface Window {
    Fintoc?: FintocSDK;
  }
}

function loadFintoc(): Promise<FintocSDK> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.Fintoc) return resolve(window.Fintoc);
    const s = document.createElement("script");
    s.src = "https://js.fintoc.com/v1/";
    s.async = true;
    s.onload = () =>
      window.Fintoc ? resolve(window.Fintoc) : reject(new Error("Fintoc no cargó"));
    s.onerror = () => reject(new Error("No se pudo cargar Fintoc"));
    document.body.appendChild(s);
  });
}

export function FintocPayButton({
  installmentId,
  publicKey,
}: {
  installmentId: string;
  publicKey: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setErr(null);
    try {
      const res = await createPortalCuotaPayment(installmentId);
      if (res.error || !res.widgetToken) {
        setErr(res.error ?? "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }
      const sdk = await loadFintoc();
      const widget = sdk.create({
        publicKey,
        widgetToken: res.widgetToken,
        holderType: "individual",
        product: "payments",
        onSuccess: () => window.location.reload(),
        onExit: () => setLoading(false),
      });
      widget.open();
    } catch {
      setErr("Error al iniciar el pago.");
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={pay}
        disabled={loading}
        className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Abriendo…" : "Pagar"}
      </button>
      {err && <p className="mt-1 text-[10px] text-red-600">{err}</p>}
    </div>
  );
}
