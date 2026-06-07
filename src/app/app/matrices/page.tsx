import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { loadDefaultPromesaTemplate, savePromesaTemplate } from "@/server/actions";
import { listPromesaTemplates } from "@/server/queries";

const VARIABLES = [
  "sociedad.razonSocial", "sociedad.rut", "sociedad.repNombre", "sociedad.repCI",
  "sociedad.domicilio", "sociedad.personeriaNotaria", "sociedad.personeriaRepertorio",
  "sociedad.personeriaFecha", "cliente.nombre", "cliente.rut", "cliente.nacionalidad",
  "cliente.estadoCivil", "cliente.profesion", "cliente.domicilio", "predio.denominacion",
  "predio.comuna", "predio.superficie", "predio.deslindeNorte", "predio.deslindeSur",
  "predio.deslindeOriente", "predio.deslindePoniente", "predio.dominioFojas",
  "predio.dominioNumero", "predio.dominioAnio", "predio.dominioCbr", "predio.rolSii",
  "subdivision.nLotes", "subdivision.certSagN", "parcela.numero", "parcela.superficieM2",
  "precio.monto", "precio.formaPago", "notaria", "ciudadFecha",
];

export default async function MatricesPage() {
  const session = await requireSession();
  if (!can(session.role, "settings:write")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo el CEO / área legal puede editar las matrices de promesa."
      />
    );
  }
  const templates = await listPromesaTemplates();
  const main = templates[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Matrices de promesa
        </h1>
        <p className="text-sm text-slate-500">
          La matriz legal con marcadores <code>{"{{variable}}"}</code>. Al generar
          una promesa se rellenan con los datos y la IA corrige/completa lo
          faltante, sin alterar tus cláusulas.
        </p>
      </div>

      {!main && (
        <Card>
          <div className="p-5">
            <EmptyState
              title="Aún no tienes matriz"
              description="Carga una matriz base (real, del rubro) que tu área legal podrá ajustar."
              action={
                <form action={loadDefaultPromesaTemplate}>
                  <Button type="submit">Cargar matriz por defecto</Button>
                </form>
              }
            />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title={main ? "Editar matriz" : "Nueva matriz"}
          subtitle="La edita el área legal. Usa los marcadores de la derecha."
        />
        <form action={savePromesaTemplate} className="grid gap-4 p-5 lg:grid-cols-[1fr_240px]">
          <div className="space-y-3">
            {main && <input type="hidden" name="id" value={main.id} />}
            <Field label="Nombre">
              <Input name="name" defaultValue={main?.name ?? "Matriz por defecto"} />
            </Field>
            <Field label="Contenido de la matriz">
              <Textarea
                name="content"
                rows={22}
                defaultValue={main?.content ?? ""}
                className="font-mono text-xs"
                placeholder="Pega aquí tu promesa con marcadores {{cliente.nombre}}…"
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Guardar matriz</Button>
            </div>
          </div>
          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Marcadores disponibles
            </p>
            <ul className="space-y-1 text-xs text-slate-600">
              {VARIABLES.map((v) => (
                <li key={v}>
                  <code className="rounded bg-white px-1 ring-1 ring-slate-200">
                    {`{{${v}}}`}
                  </code>
                </li>
              ))}
            </ul>
          </aside>
        </form>
      </Card>
    </div>
  );
}
