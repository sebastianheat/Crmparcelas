"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ROLE_LABELS, can } from "@/lib/roles";
import type { Role } from "@/db/schema";
import { doSignOut } from "@/app/app/auth-actions";
import { switchTenant } from "@/server/actions";

type TenantOption = { id: string; name: string; role: Role };

function TenantSwitcher({
  tenants,
  activeTenantId,
  currentName,
}: {
  tenants: TenantOption[];
  activeTenantId: string;
  currentName: string;
}) {
  if (tenants.length <= 1) {
    return (
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{currentName}</p>
        <p className="hidden text-xs text-slate-400 sm:block">Empresa activa</p>
      </div>
    );
  }
  return (
    <details className="group relative min-w-0">
      <summary className="flex cursor-pointer list-none items-center gap-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{currentName}</p>
          <p className="hidden text-xs text-slate-400 sm:block">Cambiar empresa</p>
        </div>
        <span className="text-slate-400 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-30 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        {tenants.map((t) => (
          <form key={t.id} action={switchTenant}>
            <input type="hidden" name="tenantId" value={t.id} />
            <button
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100",
                t.id === activeTenantId ? "font-semibold text-brand-700" : "text-slate-700",
              )}
            >
              <span className="truncate">{t.name}</span>
              {t.id === activeTenantId && <span className="text-brand-600">✓</span>}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}

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
      { href: "/app/importar", label: "Importar leads", icon: "↥" },
      { href: "/app/integraciones", label: "Integraciones", icon: "⧉" },
      { href: "/app/whatsapp", label: "Agente WhatsApp", icon: "◍" },
      { href: "/app/proyectos", label: "Proyectos y Stock", icon: "▤" },
      { href: "/app/clientes", label: "Clientes", icon: "◉" },
      { href: "/app/legal/cargar", label: "Carpeta digital", icon: "🗂" },
      { href: "/app/prefacturacion", label: "Prefacturación", icon: "₿" },
      { href: "/app/cobranza", label: "Cobranza", icon: "◷" },
      { href: "/app/recordatorios", label: "Recordatorios", icon: "◔" },
      { href: "/app/conciliacion", label: "Conciliación", icon: "⇄" },
      { href: "/app/flujo-caja", label: "Flujo de caja", icon: "≈" },
      { href: "/app/comisiones", label: "Comisiones", icon: "％" },
      { href: "/app/costos", label: "Costos", icon: "▸" },
      { href: "/app/reportes", label: "Reportes", icon: "▥" },
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

function canSee(role: Role, href: string): boolean {
  return (
    (href !== "/app/equipo" || can(role, "users:manage")) &&
    ((href !== "/app/sociedades" &&
      href !== "/app/matrices" &&
      href !== "/app/legal" &&
      href !== "/app/integraciones") ||
      can(role, "settings:write")) &&
    ((href !== "/app/comisiones" &&
      href !== "/app/conciliacion" &&
      href !== "/app/flujo-caja") ||
      can(role, "finance:read")) &&
    ((href !== "/app/crm" &&
      href !== "/app/whatsapp" &&
      href !== "/app/importar") ||
      can(role, "reservas:create")) &&
    (href !== "/app/reportes" ||
      can(role, "finance:read") ||
      can(role, "reservas:create"))
  );
}

function NavGroups({
  role,
  pathname,
  onNavigate,
}: {
  role: Role;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.section}
          </p>
          <ul className="space-y-1">
            {group.items
              .filter((item) => canSee(role, item.href))
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
                      onClick={item.soon ? undefined : onNavigate}
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
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-bold tracking-tight text-brand-600">5000</span>
      <span className="text-xs text-slate-400">by HEAT</span>
    </div>
  );
}

export function AppShell({
  children,
  tenantName,
  userName,
  role,
  tenants = [],
  activeTenantId = "",
}: {
  children: ReactNode;
  tenantName: string;
  userName: string;
  role: Role;
  tenants?: TenantOption[];
  activeTenantId?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <Brand />
        </div>
        <NavGroups role={role} pathname={pathname} />
      </aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-100 px-5">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>
            <NavGroups
              role={role}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
              aria-label="Abrir menú"
            >
              <span className="block text-lg leading-none">☰</span>
            </button>
            <TenantSwitcher
              tenants={tenants}
              activeTenantId={activeTenantId}
              currentName={tenantName}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
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
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
