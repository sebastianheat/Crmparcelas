import { Button, Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { runRemindersNow } from "@/server/actions";
import { getRemindersPreview } from "@/server/queries";

export default async function RemindersPage() {
  const session = await requireSession();
  if (!can(session.role, "events:write")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Los recordatorios son para el equipo comercial / finanzas."
      />
    );
  }
  const { vencidas, porVencer, leadsStale } = await getRemindersPreview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Recordatorios</h1>
        <p className="text-sm text-slate-500">
          Automatización diaria: avisos de cobranza a clientes por WhatsApp y
          alertas de leads sin seguimiento.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Cuotas vencidas" value={vencidas} />
        <Stat label="Cuotas por vencer (≤3 días)" value={porVencer} />
        <Stat label="Leads sin contacto (>3 días)" value={leadsStale} />
      </div>

      <Card>
        <CardHeader
          title="Cómo funciona"
          subtitle="Se ejecuta solo todos los días; aquí puedes correrlo manualmente."
        />
        <div className="space-y-4 p-5 text-sm text-slate-600">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Cobranza:</strong> a cada cliente con una cuota que vence en
              3 días o ya vencida, se le envía un recordatorio por WhatsApp (sin
              repetir el mismo aviso).
            </li>
            <li>
              <strong>Leads:</strong> los leads en etapa activa sin contacto hace
              más de 3 días reciben una nota de seguimiento en su ficha.
            </li>
          </ul>
          <p className="text-xs text-slate-400">
            La ejecución automática corre vía Vercel Cron una vez al día. El envío
            real de WhatsApp depende del proveedor configurado (mock por ahora).
          </p>
          <form action={runRemindersNow}>
            <Button type="submit">Ejecutar recordatorios ahora</Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
