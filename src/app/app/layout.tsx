import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  return (
    <AppShell
      tenantName={session.tenantName}
      userName={session.user.name ?? session.user.email ?? "Usuario"}
      role={session.role}
    >
      {children}
    </AppShell>
  );
}
