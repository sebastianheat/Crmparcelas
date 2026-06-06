import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { ASSIGNABLE_ROLES, ROLE_LABELS, can } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { createUser } from "@/server/actions";
import { listMembers } from "@/server/queries";

export default async function TeamPage() {
  const session = await requireSession();
  const allowed = can(session.role, "users:manage");

  if (!allowed) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo el CEO o el Gerente Comercial pueden gestionar usuarios y roles."
      />
    );
  }

  const members = await listMembers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Equipo</h1>
        <p className="text-sm text-slate-500">
          Crea usuarios con su rol. El rol define quién puede crear reservas vs.
          validarlas.
        </p>
      </div>

      <Card>
        <CardHeader title="Nuevo usuario" />
        <form
          action={createUser}
          className="grid items-end gap-4 p-5 sm:grid-cols-5"
        >
          <Field label="Nombre">
            <Input name="name" required placeholder="Nombre Apellido" />
          </Field>
          <Field label="Correo">
            <Input name="email" type="email" required placeholder="vendedor@5000.cl" />
          </Field>
          <Field label="Contraseña" hint="Mínimo 6 caracteres">
            <Input name="password" type="text" required placeholder="••••••" />
          </Field>
          <Field label="Rol">
            <Select name="role" defaultValue="vendedor">
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Crear usuario</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Miembros (${members.length})`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Correo</th>
                <th className="px-5 py-3 font-medium">Rol</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.membershipId} className="border-b border-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {m.name}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{m.email}</td>
                  <td className="px-5 py-3">
                    <Badge tone="blue">{ROLE_LABELS[m.role]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
