import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  Select,
} from "@/components/ui";
import { PARCEL_STATUS, PROJECT_STATUS } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import { addParcels, generateLanding } from "@/server/actions";
import { getProjectBySlug } from "@/server/queries";

export default async function ProjectDetailPage({
  params,
}: PageProps<"/app/proyectos/[slug]">) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const st = PROJECT_STATUS[project.status];
  const ubic = [project.comuna, project.provincia, project.region]
    .filter(Boolean)
    .join(", ");
  const libres = project.parcels.filter((p) => p.status === "disponible").length;
  const fact = project.factibilidad ?? {};
  const factList = [
    fact.luz && "Luz",
    fact.aguaPotable && "Agua potable",
    fact.aguaRegadio && "Agua de regadío",
    fact.iluminacionCaminos && "Iluminación caminos",
    fact.portonAutomatico && "Portón automático",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {project.name}
            </h1>
            <Badge tone={st?.tone}>{st?.label ?? project.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{ubic || "Sin ubicación"}</p>
        </div>
        <LinkButton href="/app/proyectos" variant="ghost">
          ← Proyectos
        </LinkButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Resumen */}
        <Card className="p-5">
          <p className="text-xs text-slate-400">Precio desde</p>
          <p className="text-lg font-semibold text-slate-900">
            {formatPrice(project.priceFrom, project.priceUnit)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Stock</p>
              <p className="font-medium text-slate-800">
                {libres}/{project.parcels.length} libres
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Acceso</p>
              <p className="font-medium text-slate-800 capitalize">
                {project.accessType ?? "—"}
              </p>
            </div>
          </div>
          {factList.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-slate-400">Factibilidad</p>
              <div className="flex flex-wrap gap-1.5">
                {factList.map((f) => (
                  <Badge key={f} tone="green">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Landing / contenido IA */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Landing publicitaria (IA)"
            subtitle="Copy generado por Claude siguiendo el speech de 5 pasos del rubro."
            action={
              <form action={generateLanding}>
                <input type="hidden" name="projectId" value={project.id} />
                <Button variant="secondary" type="submit">
                  {project.landingCopy ? "Regenerar" : "Generar con IA"}
                </Button>
              </form>
            }
          />
          <div className="p-5">
            {project.landingCopy ? (
              <article className="prose-min max-h-80 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">
                {project.landingCopy}
              </article>
            ) : (
              <p className="text-sm text-slate-400">
                Aún no se ha generado contenido. Pulsa “Generar con IA”.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Stock */}
      <Card>
        <CardHeader
          title="Stock de parcelas"
          subtitle="Verde = disponible · cada parcela guarda su historial inmutable."
        />
        {project.parcels.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">
            Sin parcelas. Agrega stock con el formulario de abajo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Lote</th>
                  <th className="px-5 py-3 font-medium">Superficie</th>
                  <th className="px-5 py-3 text-right font-medium">Precio</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {project.parcels.map((parcel) => {
                  const ps = PARCEL_STATUS[parcel.status];
                  return (
                    <tr
                      key={parcel.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {parcel.code}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {parcel.areaM2 ? `${parcel.areaM2} m²` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {formatPrice(parcel.price, parcel.priceUnit)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={ps?.tone}>{ps?.label ?? parcel.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {parcel.currentClient?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/app/parcelas/${parcel.id}`}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          Gestionar →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Agregar parcelas */}
      <Card>
        <CardHeader
          title="Agregar stock"
          subtitle="Crea varias parcelas de una vez con numeración automática."
        />
        <form
          action={addParcels}
          className="grid items-end gap-4 p-5 sm:grid-cols-5"
        >
          <input type="hidden" name="projectId" value={project.id} />
          <Field label="Prefijo">
            <Input name="prefix" defaultValue="L" />
          </Field>
          <Field label="Cantidad">
            <Input name="count" type="number" min={1} max={200} defaultValue={10} />
          </Field>
          <Field label="Superficie (m²)">
            <Input name="areaM2" defaultValue="5000" inputMode="numeric" />
          </Field>
          <Field label="Precio">
            <Input name="price" inputMode="numeric" placeholder="14990000" />
          </Field>
          <div className="flex gap-2">
            <Select name="priceUnit" defaultValue="clp" className="w-24">
              <option value="clp">CLP</option>
              <option value="uf">UF</option>
            </Select>
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
