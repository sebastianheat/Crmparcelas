import Link from "next/link";
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
import { createClient } from "@/server/actions";
import { listClients } from "@/server/queries";

export default async function ClientsPage() {
  const session = await requireSession();
  const canWrite = can(session.role, "events:write");
  const clients = await listClients();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-500">
          Datos completos del comprador — alimentan la promesa de compraventa.
        </p>
      </div>

      {canWrite && (
        <Card>
          <CardHeader
            title="Nuevo cliente"
            subtitle="Mientras más completo, menos hay que llenar al generar la promesa."
          />
          <form action={createClient} className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Nombre completo">
              <Input name="name" required placeholder="Denisse Astorga Sequel" />
            </Field>
            <Field label="RUT">
              <Input name="rut" placeholder="17.374.257-6" />
            </Field>
            <Field label="Estado civil">
              <Input name="estadoCivil" placeholder="Casada" />
            </Field>
            <Field label="Profesión u oficio">
              <Input name="profesion" placeholder="Trabajadora social" />
            </Field>
            <Field label="Nacionalidad">
              <Input name="nacionalidad" defaultValue="chilena" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="cliente@correo.cl" />
            </Field>
            <Field label="Teléfono">
              <Input name="phone" placeholder="+56 9 6631 4899" />
            </Field>
            <Field label="Teléfono 2">
              <Input name="phone2" placeholder="+56 9 ..." />
            </Field>
            <Field label="Dirección">
              <Input name="direccion" placeholder="Nemesio Antúnez 271, Maipú, RM" />
            </Field>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit">Crear cliente</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader title={`Clientes (${clients.length})`} />
        {clients.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Sin clientes" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">RUT</th>
                  <th className="px-5 py-3 font-medium">Estado civil</th>
                  <th className="px-5 py-3 font-medium">Profesión</th>
                  <th className="px-5 py-3 font-medium">Contacto</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="px-5 py-3 font-medium">
                      <Link
                        href={`/app/clientes/${c.id}`}
                        className="text-slate-900 hover:text-brand-600"
                      >
                        {c.name}
                      </Link>
                      {c.direccion && (
                        <div className="text-xs text-slate-400">{c.direccion}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.rut ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {c.estadoCivil ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {c.profesion ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {c.email ?? c.phone ?? "—"}
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
