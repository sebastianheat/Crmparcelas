"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  id: string;
  name: string;
  rut: string | null;
  estadoCivil: string | null;
  profesion: string | null;
  email: string | null;
  phone: string | null;
  direccion: string | null;
};

/** Listado de clientes con buscador por nombre/RUT (reunión 20-07-2026). */
export function ClientList({ clients }: { clients: Row[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        (c.rut ?? "").toLowerCase().includes(t) ||
        (c.email ?? "").toLowerCase().includes(t) ||
        (c.phone ?? "").includes(t),
    );
  }, [clients, q]);

  return (
    <>
      <div className="border-b border-slate-100 p-4">
        <div className="relative max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, RUT, correo o teléfono…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
        {q && (
          <p className="mt-1 text-xs text-slate-400">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="p-5 text-sm text-slate-400">Sin resultados para “{q}”.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">RUT</th>
                <th className="px-5 py-3 font-medium">Estado civil</th>
                <th className="px-5 py-3 font-medium">Profesión</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`/app/clientes/${c.id}`}
                      className="text-slate-900 hover:text-brand-600"
                    >
                      {c.name}
                    </Link>
                    {c.direccion && (
                      <div className="text-xs text-slate-400">{c.direccion}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.rut ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{c.estadoCivil ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{c.profesion ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{c.email ?? c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
