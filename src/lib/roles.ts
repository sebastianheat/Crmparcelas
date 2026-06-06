import type { Role } from "@/db/schema";

/** Etiquetas legibles de cada rol (set completo, Fase 2). */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "CEO / Super Admin",
  gerente_comercial: "Gerente Comercial",
  jefe_ventas: "Jefe de Ventas",
  vendedor: "Vendedor / Ejecutivo",
  gerente_finanzas: "Gerente de Finanzas",
  contador: "Contador",
  cajero: "Cajero",
  finanzas: "Finanzas (legacy)",
  gerente_legal: "Gerente Legal",
  gerente_marketing: "Gerente de Marketing",
  corredor: "Corredor externo",
};

/** Roles ofrecidos al crear/editar usuarios (excluye el legacy `finanzas`). */
export const ASSIGNABLE_ROLES: Role[] = [
  "super_admin",
  "gerente_comercial",
  "jefe_ventas",
  "vendedor",
  "gerente_finanzas",
  "contador",
  "cajero",
  "gerente_legal",
  "gerente_marketing",
  "corredor",
];

/** Roles que pueden figurar como vendedor responsable de una reserva. */
export const SELLER_ROLES: Role[] = [
  "vendedor",
  "jefe_ventas",
  "gerente_comercial",
  "super_admin",
];

export type Permission =
  | "projects:read"
  | "projects:write"
  | "parcels:read"
  | "parcels:write"
  | "events:write"
  | "reservas:create"
  | "reservas:validate"
  | "billing:read"
  | "billing:write"
  | "finance:read"
  | "finance:write"
  | "content:generate"
  | "users:manage"
  | "settings:write";

const ALL: Permission[] = [
  "projects:read",
  "projects:write",
  "parcels:read",
  "parcels:write",
  "events:write",
  "reservas:create",
  "reservas:validate",
  "billing:read",
  "billing:write",
  "finance:read",
  "finance:write",
  "content:generate",
  "users:manage",
  "settings:write",
];

const FINANCE: Permission[] = [
  "projects:read",
  "parcels:read",
  "billing:read",
  "billing:write",
  "finance:read",
  "reservas:validate",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // CEO: todo.
  super_admin: ALL,
  // Comercial: crea reservas, gestiona stock y equipo. No valida (eso es finanzas).
  gerente_comercial: [
    "projects:read",
    "projects:write",
    "parcels:read",
    "parcels:write",
    "events:write",
    "reservas:create",
    "billing:read",
    "finance:read",
    "content:generate",
    "users:manage",
  ],
  jefe_ventas: [
    "projects:read",
    "parcels:read",
    "parcels:write",
    "events:write",
    "reservas:create",
    "billing:read",
  ],
  vendedor: ["projects:read", "parcels:read", "events:write", "reservas:create"],
  // Finanzas: validan reservas (con comprobante). No crean ventas.
  gerente_finanzas: [...FINANCE, "finance:write"],
  contador: FINANCE,
  cajero: ["projects:read", "parcels:read", "billing:read", "reservas:validate"],
  finanzas: [...FINANCE, "finance:write"], // legacy = gerente_finanzas
  gerente_legal: [
    "projects:read",
    "parcels:read",
    "parcels:write",
    "events:write",
    "billing:read",
  ],
  gerente_marketing: ["projects:read", "projects:write", "content:generate"],
  corredor: ["projects:read", "parcels:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
