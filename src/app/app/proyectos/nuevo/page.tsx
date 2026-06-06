import { LinkButton, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { createProject } from "@/server/actions";

const STATUSES: { value: string; label: string }[] = [
  { value: "proximo_lanzamiento", label: "Próximo Lanzamiento" },
  { value: "en_verde", label: "En Verde" },
  { value: "etapa", label: "Etapa" },
  { value: "entrega_inmediata", label: "Entrega Inmediata" },
  { value: "escriturable", label: "Escriturable" },
  { value: "nuevo", label: "Nuevo" },
  { value: "vendido_100", label: "100% Vendido" },
];

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Nuevo proyecto</h1>
        <LinkButton href="/app/proyectos" variant="ghost">
          ← Volver
        </LinkButton>
      </div>

      <Card>
        <CardHeader
          title="Datos del proyecto"
          subtitle="Estos datos alimentan la landing, el brochure y el speech de ventas."
        />
        <form action={createProject} className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del proyecto">
              <Input name="name" required placeholder="Valle de Codegua" />
            </Field>
            <Field label="Sub-marca (opcional)">
              <Input name="subBrand" placeholder="Toscana" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Comuna">
              <Input name="comuna" placeholder="Codegua" />
            </Field>
            <Field label="Provincia">
              <Input name="provincia" placeholder="Cachapoal" />
            </Field>
            <Field label="Región">
              <Input name="region" placeholder="O'Higgins" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Precio desde">
              <Input name="priceFrom" placeholder="14990000" inputMode="numeric" />
            </Field>
            <Field label="Unidad">
              <Select name="priceUnit" defaultValue="clp">
                <option value="clp">CLP</option>
                <option value="uf">UF</option>
              </Select>
            </Field>
            <Field label="Estado / Badge">
              <Select name="status" defaultValue="proximo_lanzamiento">
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Tipo de acceso">
            <Select name="accessType" defaultValue="">
              <option value="">—</option>
              <option value="asfaltado">Asfaltado</option>
              <option value="estabilizado">Estabilizado</option>
              <option value="tierra">Tierra</option>
            </Select>
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">
              Factibilidad
            </legend>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 sm:grid-cols-3">
              {[
                ["luz", "Luz"],
                ["aguaPotable", "Agua potable"],
                ["aguaRegadio", "Agua de regadío"],
                ["iluminacionCaminos", "Iluminación caminos"],
                ["portonAutomatico", "Portón automático"],
              ].map(([name, label]) => (
                <label key={name} className="flex items-center gap-2">
                  <input type="checkbox" name={name} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Descripción / notas">
            <Textarea name="description" rows={3} placeholder="Notas internas o para el speech…" />
          </Field>

          <div className="flex justify-end gap-2">
            <LinkButton href="/app/proyectos" variant="secondary">
              Cancelar
            </LinkButton>
            <Button type="submit">Crear proyecto</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
