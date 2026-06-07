import { notFound } from "next/navigation";
import { StockMap } from "@/components/stock-map";
import { PROJECT_STATUS } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import { getPublicProject } from "@/server/queries";

export async function generateMetadata({
  params,
}: PageProps<"/p/[tenant]/[project]">) {
  const { tenant, project } = await params;
  const data = await getPublicProject(tenant, project);
  return {
    title: data ? `${data.project.name} — ${data.tenant.name}` : "Proyecto",
    description: data?.project.description ?? undefined,
  };
}

export default async function PublicProjectPage({
  params,
}: PageProps<"/p/[tenant]/[project]">) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const data = await getPublicProject(tenantSlug, projectSlug);
  if (!data) notFound();

  const { tenant, project } = data;
  const brand = tenant.brandPrimary || "#1f7a4d";
  const st = PROJECT_STATUS[project.status];
  const ubic = [project.comuna, project.provincia, project.region]
    .filter(Boolean)
    .join(", ");
  const total = project.parcels.length;
  const libres = project.parcels.filter((p) => p.status === "disponible").length;
  const fact = project.factibilidad ?? {};
  const factList = [
    fact.luz && "Luz",
    fact.aguaPotable && "Agua potable",
    fact.aguaRegadio && "Agua de regadío",
    fact.iluminacionCaminos && "Iluminación de caminos",
    fact.portonAutomatico && "Portón automático",
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <header className="px-6 py-10 text-white" style={{ backgroundColor: brand }}>
        <div className="mx-auto max-w-5xl">
          <p className="text-sm/relaxed opacity-90">{tenant.name}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{project.name}</h1>
          {ubic && <p className="mt-1 text-lg opacity-95">{ubic}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {project.priceFrom && (
              <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
                <span className="text-xs uppercase tracking-wide opacity-80">
                  Desde
                </span>
                <p className="text-xl font-semibold">
                  {formatPrice(project.priceFrom, project.priceUnit)}
                </p>
              </div>
            )}
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
              <span className="text-xs uppercase tracking-wide opacity-80">
                Disponibles
              </span>
              <p className="text-xl font-semibold">
                {libres} de {total}
              </p>
            </div>
            {st && (
              <span className="rounded-full bg-white px-3 py-1 text-sm font-medium" style={{ color: brand }}>
                {st.label}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        {/* Atributos */}
        {(factList.length > 0 || project.accessType) && (
          <section className="flex flex-wrap gap-2">
            {project.accessType && (
              <span className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 capitalize">
                Acceso {project.accessType}
              </span>
            )}
            {factList.map((f) => (
              <span
                key={f}
                className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200"
              >
                {f}
              </span>
            ))}
          </section>
        )}

        {/* Landing copy */}
        {project.landingCopy && (
          <section className="prose-min whitespace-pre-wrap rounded-2xl bg-white p-6 text-slate-700 shadow-sm">
            {project.landingCopy}
          </section>
        )}

        {/* Mapa de stock */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-900">
            Mapa de parcelas
          </h2>
          <StockMap parcels={project.parcels} />
        </section>

        {/* CTA */}
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            ¿Te interesa una parcela?
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Contáctanos para agendar una visita a terreno.
          </p>
          <p className="mt-4 text-sm text-slate-400">{tenant.name}</p>
        </section>
      </div>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Publicado con <span className="font-semibold text-brand-600">5000</span>{" "}
        · 5000.cl
      </footer>
    </main>
  );
}
