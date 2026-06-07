import type { ReactNode } from "react";

/** Ventana de navegador para enmarcar los mockups del producto. */
export function BrowserFrame({
  url = "app.5000.cl",
  children,
  className = "",
}: {
  url?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-brand-900/10 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-center text-xs text-slate-400 ring-1 ring-slate-200">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

function Spark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 60" className={className} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34c97e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34c97e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,45 C20,40 30,20 50,22 C70,24 80,38 100,30 C120,22 130,8 150,12 C170,16 185,6 200,10"
        fill="none"
        stroke="#18643f"
        strokeWidth="2.5"
      />
      <path
        d="M0,45 C20,40 30,20 50,22 C70,24 80,38 100,30 C120,22 130,8 150,12 C170,16 185,6 200,10 L200,60 L0,60 Z"
        fill="url(#sp)"
      />
    </svg>
  );
}

/** Dashboard del CRM (hero). */
export function DashboardMockup() {
  return (
    <div className="flex h-full bg-white text-left">
      {/* sidebar */}
      <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-slate-100 bg-slate-50/70 p-3 sm:flex">
        <div className="mb-2 flex items-baseline gap-1 px-1">
          <span className="text-lg font-bold text-brand-600">5000</span>
        </div>
        {["Dashboard", "CRM", "Proyectos", "Cobranza", "Comisiones"].map((x, i) => (
          <div
            key={x}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
              i === 0 ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-500"
            }`}
          >
            <span className="h-2 w-2 rounded-sm bg-current opacity-50" />
            {x}
          </div>
        ))}
      </div>
      {/* main */}
      <div className="flex-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Dashboard</p>
          <div className="h-6 w-20 rounded-md bg-brand-600" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Ingresado", "$184M"],
            ["Prometido", "$92M"],
            ["Margen", "$61M"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-100 p-2.5">
              <p className="text-[10px] text-slate-400">{k}</p>
              <p className="text-sm font-bold text-slate-900">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-slate-100 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-slate-600">
              Recaudación mensual
            </p>
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold text-brand-700">
              +24%
            </span>
          </div>
          <Spark className="mt-2 h-16 w-full" />
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            ["Linares 2 · L-14", "Prometido", "bg-amber-100 text-amber-700"],
            ["San Javier · L-03", "Escriturado", "bg-brand-100 text-brand-700"],
            ["Teno IV · A-7", "Reservado", "bg-blue-100 text-blue-700"],
          ].map(([p, s, c]) => (
            <div
              key={p}
              className="flex items-center justify-between rounded-md border border-slate-100 px-2.5 py-1.5"
            >
              <span className="text-[11px] text-slate-600">{p}</span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${c}`}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Embudo / kanban. */
export function KanbanMockup() {
  const cols: [string, string[]][] = [
    ["Nuevo", ["Camila R.", "José P."]],
    ["Contactado", ["Marta N."]],
    ["Negociación", ["Elizabeth J.", "Leonel Y."]],
    ["Ganado", ["Ana V."]],
  ];
  return (
    <div className="flex gap-2 bg-slate-50 p-4">
      {cols.map(([title, items]) => (
        <div key={title} className="flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-600">{title}</span>
            <span className="rounded bg-white px-1 text-[9px] text-slate-400 ring-1 ring-slate-200">
              {items.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {items.map((n) => (
              <div
                key={n}
                className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm"
              >
                <p className="text-[11px] font-medium text-slate-800">{n}</p>
                <p className="text-[9px] text-slate-400">WhatsApp · San Javier</p>
                <div className="mt-1 h-1 w-2/3 rounded bg-brand-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Promesa generada con IA. */
export function PromesaMockup() {
  return (
    <div className="bg-slate-50 p-5">
      <div className="mx-auto max-w-sm rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
            Promesa de Compraventa
          </span>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-semibold text-brand-700">
            ✨ IA
          </span>
        </div>
        <div className="space-y-1.5">
          {[100, 92, 96, 70, 88, 60].map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded bg-slate-200"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <div className="mt-3 rounded-md bg-brand-50 p-2 text-[10px] text-brand-800">
          PRIMERO: Inmueble Lote N°14, comuna de Villa Alegre…
        </div>
        <div className="mt-4 flex gap-1.5">
          {["PDF", "Word", "Firma e-"].map((c) => (
            <span
              key={c}
              className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-600"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Conversación del agente IA por WhatsApp (teléfono). */
export function WhatsappMockup() {
  return (
    <div className="flex justify-center bg-gradient-to-b from-brand-50 to-white p-6">
      <div className="w-56 overflow-hidden rounded-[2rem] border-[6px] border-slate-900 bg-[#e5ddd5] shadow-xl">
        <div className="bg-brand-700 px-3 py-2 text-[11px] font-semibold text-white">
          5000 · Asistente
        </div>
        <div className="space-y-2 p-3">
          <div className="ml-auto w-fit max-w-[80%] rounded-lg rounded-tr-none bg-[#dcf8c6] px-2.5 py-1.5 text-[10px] text-slate-800">
            Hola, ¿tienen parcelas en San Javier?
          </div>
          <div className="w-fit max-w-[85%] rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 text-[10px] text-slate-800 shadow-sm">
            ¡Hola! 🌿 Sí, tenemos en San Javier desde 5.000 m². ¿Es para
            inversión o casa de campo?
          </div>
          <div className="ml-auto w-fit max-w-[80%] rounded-lg rounded-tr-none bg-[#dcf8c6] px-2.5 py-1.5 text-[10px] text-slate-800">
            Casa de campo
          </div>
          <div className="w-fit rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 text-[10px] text-slate-800 shadow-sm">
            Genial 🙌 Te agendo una visita…
          </div>
          <div className="mx-auto w-fit rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-semibold text-white">
            ✓ Lead creado en el CRM
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cobranza / cuotas. */
export function FinanceMockup() {
  const rows: [string, string, string, string][] = [
    ["Cuota 1", "10 ene", "$850.000", "Pagada"],
    ["Cuota 2", "10 feb", "$850.000", "Pagada"],
    ["Cuota 3", "10 mar", "$850.000", "Vencida"],
    ["Cuota 4", "10 abr", "$850.000", "Pendiente"],
  ];
  const tone: Record<string, string> = {
    Pagada: "bg-brand-100 text-brand-700",
    Vencida: "bg-red-100 text-red-700",
    Pendiente: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="bg-white p-4">
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          ["Recaudado", "$1,7M"],
          ["Por cobrar", "$1,7M"],
          ["Vencido", "$850K"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-100 p-2">
            <p className="text-[10px] text-slate-400">{k}</p>
            <p className="text-xs font-bold text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-100">
        {rows.map(([c, d, m, s], i) => (
          <div
            key={c}
            className={`flex items-center justify-between px-3 py-2 text-[11px] ${
              i % 2 ? "bg-slate-50/60" : "bg-white"
            }`}
          >
            <span className="font-medium text-slate-700">{c}</span>
            <span className="text-slate-400">{d}</span>
            <span className="text-slate-600">{m}</span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${tone[s]}`}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
