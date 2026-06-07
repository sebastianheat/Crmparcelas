import Link from "next/link";
import { PARCEL_STATUS } from "@/lib/labels";

type StockParcel = {
  id: string;
  code: string;
  status: string;
  areaM2?: string | number | null;
};

const CELL: Record<string, string> = {
  disponible: "bg-emerald-500 text-white hover:bg-emerald-600",
  reservada: "bg-amber-400 text-amber-950 hover:bg-amber-500",
  prometida: "bg-amber-500 text-white hover:bg-amber-600",
  escriturada: "bg-red-500 text-white hover:bg-red-600",
  inscrita: "bg-red-600 text-white hover:bg-red-700",
  entregada: "bg-red-700 text-white hover:bg-red-800",
  resciliada: "bg-slate-300 text-slate-700 hover:bg-slate-400",
  bloqueada: "bg-slate-400 text-white hover:bg-slate-500",
};

/**
 * Mapa visual de stock: cada parcela es un tile coloreado por estado.
 * Si se pasa `hrefBase`, cada tile enlaza a `${hrefBase}/${id}` (vista interna).
 */
export function StockMap({
  parcels,
  hrefBase,
}: {
  parcels: StockParcel[];
  hrefBase?: string;
}) {
  const taken = (s: string) =>
    !["disponible", "resciliada", "bloqueada"].includes(s);
  const disponibles = parcels.filter((p) => p.status === "disponible").length;
  const vendidas = parcels.filter((p) => taken(p.status)).length;
  const reservadas = parcels.filter((p) => p.status === "reservada").length;

  if (parcels.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        Aún no hay parcelas cargadas en este proyecto.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-500" /> Disponible ({disponibles})
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-500" /> Reservada ({reservadas})
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-red-600" /> Vendida ({vendidas})
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {parcels.map((p) => {
          const ps = PARCEL_STATUS[p.status];
          const title = `${p.code} · ${ps?.label ?? p.status}${
            p.areaM2 ? ` · ${Math.round(Number(p.areaM2))} m²` : ""
          }`;
          const cls = `flex aspect-square flex-col items-center justify-center rounded-lg text-center text-xs font-semibold transition-colors ${
            CELL[p.status] ?? "bg-slate-200 text-slate-600"
          }`;
          const inner = (
            <>
              <span>{p.code}</span>
              {p.areaM2 ? (
                <span className="text-[10px] font-normal opacity-90">
                  {Math.round(Number(p.areaM2))} m²
                </span>
              ) : null}
            </>
          );
          return hrefBase ? (
            <Link key={p.id} href={`${hrefBase}/${p.id}`} title={title} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={p.id} title={title} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
