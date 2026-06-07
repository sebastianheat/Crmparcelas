import { Card, EmptyState } from "@/components/ui";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";

const REPORTS = [
  ["cobranza", "Cobranza", "Todas las cuotas con vencimiento, monto y estado.", "finance"],
  ["comprobantes", "Comprobantes de dinero", "Reservas, cuotas y pagos con folio y estado.", "finance"],
  ["comisiones", "Comisiones", "Cobros y comisión por vendedor.", "finance"],
  ["movimientos", "Movimientos bancarios", "Conciliación: movimientos y su estado.", "finance"],
  ["leads", "Leads (CRM)", "Embudo completo con origen, etapa y asignación.", "sales"],
] as const;

export default async function ReportsPage() {
  const session = await requireSession();
  const isFinance = can(session.role, "finance:read");
  const isSales = can(session.role, "reservas:create");
  const visible = REPORTS.filter((r) =>
    r[3] === "finance" ? isFinance : isSales,
  );

  if (visible.length === 0) {
    return (
      <EmptyState
        title="Sin reportes disponibles"
        description="Tu rol no tiene reportes habilitados."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-500">
          Exporta a Excel/CSV para tu contabilidad y análisis. Abre directo en
          Excel o Google Sheets.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(([type, title, desc]) => (
          <Card key={type} className="flex flex-col p-5">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 flex-1 text-sm text-slate-600">{desc}</p>
            <a
              href={`/api/export/${type}`}
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              ⬇ Descargar CSV
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
