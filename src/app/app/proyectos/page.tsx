import Link from "next/link";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
} from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import { listProjects } from "@/server/queries";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Proyectos y Stock
          </h1>
          <p className="text-sm text-slate-500">
            Tus loteos con trazabilidad total de cada parcela.
          </p>
        </div>
        <LinkButton href="/app/proyectos/nuevo">+ Nuevo proyecto</LinkButton>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="Sin proyectos aún"
          description="Crea un proyecto en pocos clics: ubicación, precio desde y atributos."
          action={
            <LinkButton href="/app/proyectos/nuevo">Crear proyecto</LinkButton>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const st = PROJECT_STATUS[p.status];
            const ubic = [p.comuna, p.region].filter(Boolean).join(", ");
            return (
              <Link key={p.id} href={`/app/proyectos/${p.slug}`}>
                <Card className="h-full p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <Badge tone={st?.tone}>{st?.label ?? p.status}</Badge>
                  </div>
                  {ubic && (
                    <p className="mt-1 text-sm text-slate-500">{ubic}</p>
                  )}
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Desde</p>
                      <p className="font-semibold text-slate-900">
                        {formatPrice(p.priceFrom, p.priceUnit)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Disponibles</p>
                      <p className="font-semibold text-emerald-700">
                        {p.freeUnits}/{p.totalUnits}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
