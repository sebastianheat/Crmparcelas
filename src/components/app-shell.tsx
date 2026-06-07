"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ROLE_LABELS, can } from "@/lib/roles";
import type { Role } from "@/db/schema";
import { doSignOut } from "@/app/app/auth-actions";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  soon?: boolean;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Operación",
    items: [
      { href: "/app", label: "Dashboard", icon: "▦" },
      { href: "/app/crm", label: "CRM y Embudo", icon: "◔" },
      { href: "/app/whatsapp", label: "Agente WhatsApp", icon: "◍" },
      { href: "/app/proyectos", label: "Proyectos y Stock", icon: "▤" },
      { href: "/app/clientes", label: "Clientes", icon: "◉" },
      { href: "/app/prefacturacion", label: "Prefacturación", icon: "₿" },
      { href: "/app/cobranza", label: "Cobranza", icon: "◷" },
      { href: "/app/conciliacion", label: "Conciliación", icon: "⇄" },
      { href: "/app/comisiones", label: "Comisiones", icon: "％" },
      { href: "/app/costos", label: "Costos", icon: "▸" },
      { href: "/app/sociedades", label: "Sociedades", icon: "⬢" },
      { href: "/app/matrices", label: "Matrices legales", icon: "▦" },
      { href: "/app/legal", label: "Causas legales", icon: "⚖" },
      { href: "/app/equipo", label: "Equipo", icon: "◆" },
    ],
  },
  {
    section: "Próximamente (Fase 2+)",
    items: [
      { href: "#", label: "Parcelas Contenido", icon: "◎", soon: true },
      { href: "#", label: "Ads", icon: "◈", soon: true },
    ],
  },
];

export function AppShell({
  children,
  tenantName,
  userName,
  role,
}: {
  children: ReactNode;
  tenantName: string;
  userName: string;
  role: Role;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <span className="text-lg font-bold tracking-tight text-brand-600">
            5000
          </span>
          <span className="text-xs text-slate-400">by HEAT</span>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.section}
              </p>
              <ul className="space-y-1">
                {group.items
                  .filter(
                    (item) =>
                      (item.href !== "/app/equipo" ||
                        can(role, "users:manage")) &&
                      ((item.href !== "/app/sociedades" &&
                        item.href !== "/app/matrices" &&
                        item.href !== "/app/legal") ||
                        can(role, "settings:write")) &&
                      ((item.href !== "/app/comisiones" &&
                        item.href !== "/app/conciliacion") ||
                        can(role, "finance:read")) &&
                      ((item.href !== "/app/crm" &&
                        item.href !== "/app/whatsapp") ||
                        can(role, "reservas:create")),
                  )
                  .map((item) => {
                  const active =
                    !item.soon &&
                    (item.href === "/app"
                      ? pathname === "/app"
                      : pathname.startsWith(item.href));
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.soon ? "#" : item.href}
                        aria-disabled={item.soon}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                          item.soon
                            ? "cursor-default text-slate-300"
                            : active
                              ? "bg-brand-50 text-brand-700"
                              : "text-slate-600 hover:bg-slate-100",
                        )}
                      >
                        <span className="w-4 text-center">{item.icon}</span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">{tenantName}</p>
            <p className="text-xs text-slate-400">Inmobiliaria · tenant activo</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{userName}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p>
            </div>
            <form action={doSignOut}>
              <button className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
                Salir
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
