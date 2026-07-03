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
  Textarea,
} from "@/components/ui";
import { StockMap } from "@/components/stock-map";
import { PARCEL_STATUS, PROJECT_STATUS } from "@/lib/labels";
import { formatPrice } from "@/lib/money";
import { requireSession } from "@/lib/session";
import {
  addParcels,
  addProjectUpdate,
  completeProjectUpdate,
  generateLanding,
  saveProjectLegal,
  updateParcelPrice,
  uploadProjectDocument,
} from "@/server/actions";
import { getProjectBySlug, listSellerCompanies } from "@/server/queries";

// La extracción de documentos con IA puede tardar varios segundos.
export const maxDuration = 60;

export default async function ProjectDetailPage({
  params,
}: PageProps<"/app/proyectos/[slug]">) {
  const { slug } = await params;
  const [session, project, companies] = await Promise.all([
    requireSession(),
    getProjectBySlug(slug),
    listSellerCompanies(),
  ]);
  if (!project) notFound();

  const publicUrl = `/p/${session.tenantSlug}/${project.slug}`;

  const acq = project.acquisition ?? {};
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
        <div className="flex items-center gap-2">
          <LinkButton href={publicUrl} variant="secondary">
            🔗 Landing pública
          </LinkButton>
          <LinkButton href="/app/proyectos" variant="ghost">
            ← Proyectos
          </LinkButton>
        </div>
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

      {/* Mapa de stock */}
      {project.parcels.length > 0 && (
        <Card>
          <CardHeader
            title="Mapa de stock"
            subtitle="Vista visual del loteo. Haz clic en una parcela para ver su detalle."
          />
          <div className="p-5">
            <StockMap parcels={project.parcels} hrefBase="/app/parcelas" />
          </div>
        </Card>
      )}

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
                        {session.role === "super_admin" &&
                        parcel.status === "disponible" ? (
                          <form
                            action={updateParcelPrice}
                            className="flex items-center justify-end gap-1"
                          >
                            <input type="hidden" name="parcelId" value={parcel.id} />
                            <input
                              name="price"
                              inputMode="numeric"
                              defaultValue={parcel.price ? Number(parcel.price) : ""}
                              placeholder="precio CLP"
                              className="w-28 rounded-md border border-slate-200 px-2 py-1 text-right text-sm focus:border-brand-400 focus:outline-none"
                            />
                            <button
                              className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                              title="Guardar precio"
                            >
                              ✓
                            </button>
                          </form>
                        ) : (
                          formatPrice(parcel.price, parcel.priceUnit)
                        )}
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

      {/* Documentos de adquisición + extracción con IA (M1) */}
      <Card>
        <CardHeader
          title="Documentos de adquisición"
          subtitle="Sube la compraventa, inscripción CBR, certificado SAG o plano. La IA puede autocompletar los datos legales."
        />
        <form
          action={uploadProjectDocument}
          className="grid items-end gap-4 p-5 sm:grid-cols-4"
        >
          <input type="hidden" name="projectId" value={project.id} />
          <Field label="Tipo de documento">
            <Select name="docType" defaultValue="inscripcion_cbr">
              <option value="compraventa">Compraventa del campo</option>
              <option value="inscripcion_cbr">Inscripción CBR</option>
              <option value="certificado_sag">Certificado SAG</option>
              <option value="asignacion_roles">Asignación de roles</option>
              <option value="plano">Plano de subdivisión</option>
              <option value="aguas">Derechos de aguas</option>
              <option value="estudio_titulos">Estudio de títulos</option>
              <option value="otro">Otro</option>
            </Select>
          </Field>
          <Field label="Archivo (PDF o imagen)">
            <Input
              name="file"
              type="file"
              accept="application/pdf,image/*"
              required
              className="file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-xs"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="extract" defaultChecked className="rounded" />
            Autocompletar con IA
          </label>
          <Button type="submit">Subir documento</Button>
        </form>
        {project.documents.length > 0 && (
          <ul className="divide-y divide-slate-100 px-5 pb-4">
            {project.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  📎 {d.title}
                </a>
                <span className="text-xs text-slate-400">
                  {d.type}
                  {d.extracted ? " · ✨ extraído" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Avances de proyecto (portal del cliente) */}
      <Card>
        <CardHeader
          title="Avances de proyecto"
          subtitle="Publica hitos, obras, avisos y plazos. El cliente los ve en su portal, con línea de tiempo y fotos."
        />
        <form
          action={addProjectUpdate}
          className="space-y-4 border-b border-slate-100 p-5"
        >
          <input type="hidden" name="projectId" value={project.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tipo">
              <Select name="kind" defaultValue="avance">
                <option value="avance">🏗️ Avance de obra</option>
                <option value="hito">🎯 Hito de etapa</option>
                <option value="notificacion">📣 Aviso al cliente</option>
                <option value="plazo">📅 Plazo comprometido</option>
              </Select>
            </Field>
            <Field label="Etapa (opcional)">
              <Input name="stage" placeholder="Urbanización, Agua, Entrega…" />
            </Field>
            <Field label="Fecha comprometida (si es plazo)">
              <Input name="dueDate" type="date" />
            </Field>
          </div>
          <Field label="Título">
            <Input name="title" required placeholder="Avance camino principal 60%" />
          </Field>
          <Field label="Detalle (opcional)">
            <Textarea
              name="body"
              rows={2}
              placeholder="Describe el avance, qué se hizo, próximos pasos…"
            />
          </Field>
          <Field label="Fotos (opcional, varias)">
            <Input
              name="images"
              type="file"
              accept="image/*"
              multiple
              className="file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-xs"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">Publicar avance</Button>
          </div>
        </form>
        {project.updates.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">
            Aún no hay avances publicados. Publica el primero arriba.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 px-5 pb-2">
            {project.updates.map((u) => {
              const demora =
                u.kind === "plazo" &&
                !u.doneAt &&
                u.dueDate != null &&
                new Date(u.dueDate).getTime() < Date.now();
              return (
                <li key={u.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-500 capitalize">
                        {u.kind}
                      </span>
                      {u.stage && (
                        <Badge tone="slate">{u.stage}</Badge>
                      )}
                      {demora && <Badge tone="red">Con retraso</Badge>}
                      {u.doneAt && <Badge tone="green">Cumplido</Badge>}
                    </div>
                    <p className="mt-0.5 font-medium text-slate-800">{u.title}</p>
                    {u.body && (
                      <p className="text-sm text-slate-500 line-clamp-2">{u.body}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString("es-CL")}
                      {u.dueDate
                        ? ` · vence ${new Date(u.dueDate).toLocaleDateString("es-CL")}`
                        : ""}
                      {u.imageUrls && u.imageUrls.length > 0
                        ? ` · ${u.imageUrls.length} foto(s)`
                        : ""}
                    </p>
                  </div>
                  {u.kind === "plazo" && !u.doneAt && (
                    <form action={completeProjectUpdate}>
                      <input type="hidden" name="updateId" value={u.id} />
                      <button className="whitespace-nowrap text-xs font-medium text-brand-600 hover:underline">
                        Marcar cumplido
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Datos legales / adquisición (alimentan la promesa) */}
      <Card>
        <CardHeader
          title="Datos legales y de adquisición"
          subtitle="Cárgalos una vez: con esto se arman las promesas del proyecto (ver docs)."
        />
        <form action={saveProjectLegal} className="space-y-5 p-5">
          <input type="hidden" name="projectId" value={project.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sociedad vendedora">
              <Select
                name="sellerCompanyId"
                defaultValue={project.sellerCompanyId ?? ""}
              >
                <option value="">—</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razonSocial}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notaría (firma)">
              <Input name="notaria" defaultValue={project.notaria ?? ""} placeholder="1ª Notaría de Lo Barnechea" />
            </Field>
          </div>

          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">
              Predio madre
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Denominación">
                <Input name="predioDenominacion" defaultValue={acq.predioDenominacion ?? ""} placeholder="Resto del Lote A, Hijuela Dos, Fundo La Cruz" />
              </Field>
              <Field label="Subdelegación">
                <Input name="subdelegacion" defaultValue={acq.subdelegacion ?? ""} placeholder="Queri" />
              </Field>
              <Field label="Superficie">
                <Input name="superficie" defaultValue={acq.superficie ?? ""} placeholder="54,50 hectáreas" />
              </Field>
              <Field label="Rol SII (predio madre)">
                <Input name="rolSii" defaultValue={acq.rolSii ?? ""} placeholder="455-83" />
              </Field>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-4">
              <Field label="Plano archivado N°">
                <Input name="planoArchivoN" defaultValue={acq.planoArchivoN ?? ""} placeholder="2323" />
              </Field>
              <Field label="CBR (plano)">
                <Input name="planoCbr" defaultValue={acq.planoCbr ?? ""} placeholder="Talca" />
              </Field>
              <Field label="Año plano">
                <Input name="planoAnio" defaultValue={acq.planoAnio ?? ""} placeholder="2020" />
              </Field>
              <Field label="Aguas">
                <Input name="aguas" defaultValue={acq.aguas ?? ""} placeholder="2 acciones Canal Maule Maitenes" />
              </Field>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-4">
              <Field label="Dominio — Fojas">
                <Input name="dominioFojas" defaultValue={acq.dominioFojas ?? ""} />
              </Field>
              <Field label="Número">
                <Input name="dominioNumero" defaultValue={acq.dominioNumero ?? ""} />
              </Field>
              <Field label="Año">
                <Input name="dominioAnio" defaultValue={acq.dominioAnio ?? ""} />
              </Field>
              <Field label="CBR (dominio)">
                <Input name="dominioCbr" defaultValue={acq.dominioCbr ?? ""} placeholder="San Clemente" />
              </Field>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Deslinde Norte">
                <Input name="deslindeNorte" defaultValue={acq.deslindes?.norte ?? ""} />
              </Field>
              <Field label="Deslinde Sur">
                <Input name="deslindeSur" defaultValue={acq.deslindes?.sur ?? ""} />
              </Field>
              <Field label="Deslinde Oriente">
                <Input name="deslindeOriente" defaultValue={acq.deslindes?.oriente ?? ""} />
              </Field>
              <Field label="Deslinde Poniente">
                <Input name="deslindePoniente" defaultValue={acq.deslindes?.poniente ?? ""} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">
              Subdivisión (SAG)
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="N° de lotes">
                <Input name="subdivisionNLotes" defaultValue={acq.subdivisionNLotes ?? ""} placeholder="79" />
              </Field>
              <Field label="Certificado SAG N°">
                <Input name="sagCertN" defaultValue={acq.sagCertN ?? ""} placeholder="1511/2023" />
              </Field>
              <Field label="Fecha SAG">
                <Input name="sagFecha" defaultValue={acq.sagFecha ?? ""} placeholder="27-04-2023" />
              </Field>
              <Field label="Archivo Cert. SAG (CBR)">
                <Input name="archivoCertSag" defaultValue={acq.archivoCertSag ?? ""} placeholder="1773" />
              </Field>
              <Field label="Archivo Roles (CBR)">
                <Input name="archivoRoles" defaultValue={acq.archivoRoles ?? ""} placeholder="1774" />
              </Field>
              <Field label="Archivo Plano (CBR)">
                <Input name="archivoPlano" defaultValue={acq.archivoPlano ?? ""} placeholder="1775" />
              </Field>
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">
              Portafolio y riesgo
            </legend>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Estado legal">
                <Select name="legalStatus" defaultValue={project.legalStatus}>
                  <option value="sin_definir">Sin definir</option>
                  <option value="sag_ingresado">Ingresado al SAG</option>
                  <option value="sag_certificado">Subdivisión certificada</option>
                  <option value="en_inscripcion">En inscripción CBR</option>
                  <option value="inscrito">Inscrito / transferible</option>
                </Select>
              </Field>
              <Field label="Riesgo">
                <Select name="riesgo" defaultValue={project.riesgo}>
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </Select>
              </Field>
              <Field label="Tenencia">
                <Select name="propio" defaultValue={project.propio ? "propio" : "ajeno"}>
                  <option value="propio">Propio</option>
                  <option value="ajeno">Ajeno (consignación)</option>
                </Select>
              </Field>
              <Field label="N° denuncias/querellas">
                <Input
                  name="denuncias"
                  type="number"
                  min={0}
                  defaultValue={project.denuncias}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Notas legales / comentario">
                <Textarea
                  name="legalNotes"
                  rows={2}
                  defaultValue={project.legalNotes ?? ""}
                  placeholder="Estado de trámites, servidumbres pendientes, denuncias…"
                />
              </Field>
            </div>
          </fieldset>

          <div className="flex justify-end">
            <Button type="submit">Guardar datos legales</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
