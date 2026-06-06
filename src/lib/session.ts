import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withTenant, type TenantDb } from "@/db/tenant";
import { can, type Permission } from "@/lib/roles";

/** Devuelve la sesión activa o redirige a /login. Para usar en Server Components/Actions. */
export async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");
  return session;
}

/** Igual que requireSession, pero además exige un permiso del rol. */
export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!can(session.role, permission)) {
    throw new Error("No tienes permiso para esta acción.");
  }
  return session;
}

/**
 * Ejecuta `fn` con la base de datos ya filtrada por el tenant de la sesión
 * (contexto RLS aplicado). Es el punto de entrada estándar para leer/escribir
 * datos de negocio desde páginas y server actions.
 */
export async function withCurrentTenant<T>(
  fn: (tx: TenantDb, ctx: { userId: string; tenantId: string }) => Promise<T>,
): Promise<T> {
  const session = await requireSession();
  return withTenant(session.tenantId, (tx) =>
    fn(tx, { userId: session.user.id, tenantId: session.tenantId }),
  );
}
