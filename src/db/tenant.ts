import { sql } from "drizzle-orm";
import { db } from "./client";

/**
 * Tipo del cliente de base de datos dentro de una transacción de tenant.
 * Todas las consultas hechas con este `tx` ven únicamente las filas del tenant
 * activo, gracias a las políticas Row-Level Security (drizzle/0000_rls.sql).
 */
export type TenantDb = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Ejecuta `fn` dentro de una transacción con el contexto de tenant fijado.
 *
 * Establece `app.current_tenant_id` con `set_config(..., true)` (alcance de
 * transacción), de modo que las políticas RLS filtran automáticamente por tenant.
 * Esto es defensa en profundidad: aunque una consulta olvide el `where tenantId`,
 * la base de datos no devolverá filas de otros tenants.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TenantDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    return fn(tx);
  });
}
