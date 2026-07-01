import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";
import { listUserTenants } from "@/server/queries";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  const { activeTenantId, tenants } = await listUserTenants();
  return (
    <AppShell
      tenantName={session.tenantName}
      userName={session.user.name ?? session.user.email ?? "Usuario"}
      role={session.role}
      tenants={tenants}
      activeTenantId={activeTenantId}
    >
      {children}
    </AppShell>
  );
}
