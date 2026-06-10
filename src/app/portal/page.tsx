import { cookies } from "next/headers";
import Link from "next/link";
import { FintocPayButton } from "@/components/fintoc-pay-button";
import { formatClp } from "@/lib/money";
import { getPortalData, verifyPortalToken } from "@/lib/portal";

export const metadata = { title: "Mi portal — 5000" };

export default async function PortalPage() {
  const token = (await cookies()).get("portal")?.value;
  const payload = verifyPortalToken(token);

  if (!payload) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Acceso al portal</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tu enlace de acceso no es válido o expiró. Pídele a tu ejecutivo un
            nuevo enlace para ver tu parcela, pagos y documentos.
          </p>
        </div>
      </Shell>
    );
  }

  const data = await getPortalData(payload.tenantId, payload.clientId);
  if (!data) {
    return (
      <Shell>
        <p className="text-center text-sm text-slate-500">
          No encontramos tu información. Contacta a tu ejecutivo.
        </p>
      </Shell>
    );
  }

  const { client, parcels, cuotas, documents } = data;
  const fintocPk = process.env.FINTOC_PUBLIC_KEY || "";
  const pagado = cuotas
    .filter((c) => c.status === "pagada")
    .reduce((a, c) => a + Number(c.amountClp), 0);
  const pendiente = cuotas
    .filter((c) => c.status !== "pagada")
    .reduce((a, c) => a + Number(c.amountClp), 0);

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Hola,</p>
          <h1 className="text-xl font-semibold text-slate-900">{client.name}</h1>
        </div>
        <Link href="/portal/salir" className="text-sm text-slate-400 hover:underline">
          Salir
        </Link>
      </div>

      {/* Parcelas */}
      <Section title="Mis parcelas">
        {parcels.length === 0 ? (
          <Empty>Aún no tienes parcelas asociadas.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {parcels.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">
                  {p.projectName} · {p.code}
                </p>
                <p className="text-sm text-slate-500">{p.comuna ?? ""}</p>
                <span className="mt-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Pagos */}
      {cuotas.length > 0 && (
        <Section title="Mi plan de pago">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Box label="Pagado" value={formatClp(pagado)} />
            <Box label="Por pagar" value={formatClp(pendiente)} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Cuota</th>
                  <th className="px-4 py-2 font-medium">Vence</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  {fintocPk && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {cuotas.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-medium">{c.number}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {new Date(c.dueDate).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-4 py-2 text-right">{formatClp(c.amountClp)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          c.status === "pagada"
                            ? "bg-brand-100 text-brand-700"
                            : c.overdue
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {c.status === "pagada" ? "Pagada" : c.overdue ? "Vencida" : "Pendiente"}
                      </span>
                    </td>
                    {fintocPk && (
                      <td className="px-4 py-2">
                        {c.status !== "pagada" && (
                          <FintocPayButton installmentId={c.id} publicKey={fintocPk} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Documentos */}
      <Section title="Mis documentos">
        {documents.length === 0 ? (
          <Empty>Aún no hay documentos disponibles.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {documents.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-600 hover:underline"
                >
                  📄 {d.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-5">
          <span className="text-xl font-bold text-brand-600">5000</span>
          <span className="text-xs text-slate-400">portal del cliente</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
