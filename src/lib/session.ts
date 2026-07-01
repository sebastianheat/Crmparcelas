import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { memberships } from "@/db/schema";
import { withTenant, type TenantDb } from "@/db/tenant";
import { can, type Permission } from "@/lib/roles";

export const ACTIVE_TENANT_COOKIE = "active_tenant";

/**
 * Sesión activa. Aplica el "selector de empresa": si hay un cookie de empresa
 * activa y el usuario tiene membresía ahí, se usa ESA empresa (tenant + rol),
 * permitiendo cambiar de tenant con el mismo usuario sin volver a iniciar sesión.
 * Redirige a /login si no hay sesión.
 */
export async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");

  const active = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  if (active && active !== session.tenantId) {
    const m = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.tenantId, active),
      ),
      with: { tenant: { columns: { name: true, slug: true } } },
    });
    if (m) {
      return {
        ...session,
        tenantId: m.tenantId,
        role: m.role,
        tenantName: m.tenant.name,
        tenantSlug: m.tenant.slug,
      };
    }
  }
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
 * Ejecuta `fn` con la base de datos ya filtrada por el tenant activo de la
 * sesión (contexto RLS aplicado). Punto de entrada estándar para leer/escribir
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
