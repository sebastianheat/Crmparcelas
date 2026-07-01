"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { uploadClientDocumentsBulk } from "@/server/actions";

type ClientRow = {
  id: string;
  name: string;
  rut: string | null;
  parcelCode: string | null;
  projectName: string | null;
  docCount: number;
};

const DOC_TYPES = [
  { value: "reserva", label: "Reserva" },
  { value: "promesa", label: "Promesa de compraventa" },
  { value: "escritura", label: "Escritura / compraventa" },
  { value: "inscripcion", label: "Inscripción CBR" },
  { value: "pago", label: "Comprobante de pago" },
  { value: "cedula", label: "Cédula / identidad" },
  { value: "otro", label: "Otro" },
];

export function BulkUploader({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [docType, setDocType] = useState("promesa");
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 50);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.rut ?? "").toLowerCase().includes(q) ||
          (c.parcelCode ?? "").toLowerCase().includes(q) ||
          (c.projectName ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [clients, query]);

  function submit() {
    if (!selected || files.length === 0) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("clientId", selected.id);
    fd.set("docType", docType);
    for (const f of files) fd.append("files", f);
    startTransition(async () => {
      try {
        await uploadClientDocumentsBulk(fd);
        setMsg(`✓ ${files.length} archivo(s) subido(s) a ${selected.name}.`);
        setFiles([]);
        if (inputRef.current) inputRef.current.value = "";
      } catch (e) {
        setMsg(`✗ Error: ${(e as Error).message}`);
      }
    });
  }

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-[320px_1fr]">
      {/* Lista de clientes */}
      <div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente, RUT, parcela…"
          className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-100">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">Sin resultados.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`flex w-full items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  selected?.id === c.id ? "bg-brand-50" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">
                    {c.name}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {[c.projectName, c.parcelCode].filter(Boolean).join(" · ") ||
                      c.rut ||
                      "—"}
                  </span>
                </span>
                {c.docCount > 0 && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {c.docCount} 📄
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Carga */}
      <div>
        {!selected ? (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
            Elige un cliente a la izquierda para subir sus documentos.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{selected.name}</p>
              <p className="text-xs text-slate-500">
                {[selected.projectName, selected.parcelCode]
                  .filter(Boolean)
                  .join(" · ") || selected.rut}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tipo de documento
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Archivos (PDF o imágenes — varios a la vez)
              </label>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-brand-50 file:px-2 file:py-1.5 file:text-xs file:text-brand-700"
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {files.map((f) => (
                    <li key={f.name}>
                      📄 {f.name}{" "}
                      <span className="text-slate-300">
                        ({Math.round(f.size / 1024)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={submit}
                disabled={pending || files.length === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {pending
                  ? "Subiendo…"
                  : `Subir ${files.length || ""} archivo(s)`}
              </button>
              {msg && (
                <span
                  className={`text-sm ${
                    msg.startsWith("✓") ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {msg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
