import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
} from "@/components/ui";
import { can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { createSellerCompany } from "@/server/actions";
import { listSellerCompanies } from "@/server/queries";

export default async function CompaniesPage() {
  const session = await requireSession();
  if (!can(session.role, "settings:write")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo el CEO / Super Admin puede gestionar las sociedades vendedoras."
      />
    );
  }
  const companies = await listSellerCompanies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Sociedades vendedoras
        </h1>
        <p className="text-sm text-slate-500">
          Las sociedades que comparecen como promitente vendedora en promesas y
          escrituras. Sus datos alimentan la promesa automáticamente.
        </p>
      </div>

      <Card>
        <CardHeader title="Nueva sociedad" />
        <form action={createSellerCompany} className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Razón social">
            <Input name="razonSocial" required placeholder="Soc. de Inversiones San Alberto SpA" />
          </Field>
          <Field label="RUT">
            <Input name="rut" placeholder="77.890.952-9" />
          </Field>
          <Field label="Domicilio">
            <Input name="domicilio" placeholder="Av. Apoquindo 5950, of. 15, Las Condes" />
          </Field>
          <Field label="Representante">
            <Input name="repNombre" placeholder="Erwin Rohrstock Fuentes" />
          </Field>
          <Field label="Cédula representante">
            <Input name="repCI" placeholder="16.606.399-K" />
          </Field>
          <Field label="Profesión representante">
            <Input name="repProfesion" placeholder="Ingeniero comercial" />
          </Field>
          <Field label="Estado civil representante">
            <Input name="repEstadoCivil" placeholder="Soltero" />
          </Field>
          <Field label="Nacionalidad representante">
            <Input name="repNacionalidad" defaultValue="chilena" />
          </Field>
          <div />
          <Field label="Personería — Notaría">
            <Input name="personeriaNotaria" placeholder="1ª Notaría de Lo Barnechea" />
          </Field>
          <Field label="Personería — Repertorio">
            <Input name="personeriaRepertorio" placeholder="1756-2025" />
          </Field>
          <Field label="Personería — Fecha">
            <Input name="personeriaFecha" placeholder="01 de abril de 2025" />
          </Field>
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit">Crear sociedad</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Sociedades (${companies.length})`} />
        {companies.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin sociedades" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Razón social</th>
                  <th className="px-5 py-3 font-medium">RUT</th>
                  <th className="px-5 py-3 font-medium">Representante</th>
                  <th className="px-5 py-3 font-medium">Personería</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {c.razonSocial}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.rut ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {c.repNombre ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {c.personeriaRepertorio
                        ? `Rep. ${c.personeriaRepertorio}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
