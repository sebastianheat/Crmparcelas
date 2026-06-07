import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
} from "@/components/ui";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { simulateInboundWhatsApp } from "@/server/actions";
import { listLeads } from "@/server/queries";

export default async function WhatsAppPage() {
  const session = await requireSession();
  if (!can(session.role, "reservas:create")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="El agente de WhatsApp es para el equipo comercial."
      />
    );
  }
  const provider = process.env.WHATSAPP_PROVIDER ?? "mock";
  const connected = provider !== "mock";
  const { rows } = await listLeads();
  const waLeads = rows.filter((r) => r.lead.source === "whatsapp").slice(0, 20);
  const webhookUrl = "https://5000.cl/api/whatsapp";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Agente IA de WhatsApp
        </h1>
        <p className="text-sm text-slate-500">
          Responde a tus leads 24/7 con IA y los carga al embudo
          automáticamente. Cada conversación queda en la ficha del lead.
        </p>
      </div>

      <Card>
        <CardHeader title="Estado de la conexión" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Badge tone={connected ? "green" : "amber"}>
              {connected ? "Conectado" : "Modo demo (mock)"}
            </Badge>
            <span className="text-sm text-slate-600">
              Proveedor: <strong>{provider}</strong>
            </span>
          </div>
          <div className="text-sm text-slate-600">
            {connected
              ? "Recibiendo mensajes reales por el proveedor configurado."
              : "Aún sin proveedor real. Puedes probar el agente con el simulador de abajo."}
          </div>
        </div>
        <div className="border-t border-slate-100 p-5 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Para conectar el número real:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Contrata un proveedor (recomendado: <strong>360dialog</strong> o
              Meta Cloud API directo).
            </li>
            <li>
              Configura el webhook en el proveedor apuntando a:{" "}
              <code className="rounded bg-slate-100 px-1">{webhookUrl}</code>
            </li>
            <li>
              Define las variables <code>WHATSAPP_PROVIDER</code>,{" "}
              <code>WHATSAPP_TOKEN</code>, <code>WHATSAPP_PHONE_NUMBER_ID</code> y{" "}
              <code>WHATSAPP_VERIFY_TOKEN</code> en Vercel.
            </li>
          </ol>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Simular mensaje entrante"
          subtitle="Prueba el agente sin proveedor: crea el lead, responde con IA y lo registra."
        />
        <form
          action={simulateInboundWhatsApp}
          className="flex flex-wrap items-end gap-3 p-5"
        >
          <Field label="Número (from)">
            <Input name="from" placeholder="+56991234567" defaultValue="+56990000000" />
          </Field>
          <div className="min-w-[280px] flex-1">
            <Field label="Mensaje del cliente">
              <Input
                name="text"
                placeholder="Hola, ¿tienen parcelas en San Javier?"
                defaultValue="Hola, busco una parcela para casa de campo, ¿qué tienen?"
              />
            </Field>
          </div>
          <Button type="submit">Enviar al agente</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Leads desde WhatsApp (${waLeads.length})`} />
        {waLeads.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Sin leads de WhatsApp todavía"
              description="Usa el simulador para ver al agente crear el primer lead."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {waLeads.map(({ lead }) => (
              <li key={lead.id}>
                <Link
                  href={`/app/crm/${lead.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{lead.name}</p>
                    <p className="text-xs text-slate-400">
                      {lead.phone} ·{" "}
                      {new Date(lead.updatedAt).toLocaleString("es-CL")}
                    </p>
                  </div>
                  <Badge tone="blue">Ver conversación →</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
