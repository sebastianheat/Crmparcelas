import type { Role } from "@/db/schema";

/** Etiquetas legibles de cada rol (§5.2 del spec). */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  gerente_legal: "Gerente Legal",
  gerente_marketing: "Gerente de Marketing",
  jefe_ventas: "Jefe de Ventas",
  vendedor: "Vendedor / Ejecutivo",
  finanzas: "Finanzas / Contador",
  corredor: "Corredor externo",
};

/**
 * Permisos por capacidad. Mapa simple y configurable de rol → acciones.
 * Las acciones se nombran "<recurso>:<verbo>".
 */
export type Permission =
  | "projects:read"
  | "projects:write"
  | "parcels:read"
  | "parcels:write"
  | "events:write"
  | "billing:read"
  | "billing:write"
  | "finance:read"
  | "finance:write"
  | "content:generate"
  | "settings:write";

const ALL: Permission[] = [
  "projects:read",
  "projects:write",
  "parcels:read",
  "parcels:write",
  "events:write",
  "billing:read",
  "billing:write",
  "finance:read",
  "finance:write",
  "content:generate",
  "settings:write",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ALL,
  gerente_legal: [
    "projects:read",
    "parcels:read",
    "parcels:write",
    "events:write",
    "billing:read",
  ],
  gerente_marketing: ["projects:read", "projects:write", "content:generate"],
  jefe_ventas: [
    "projects:read",
    "parcels:read",
    "parcels:write",
    "events:write",
    "billing:read",
  ],
  vendedor: ["projects:read", "parcels:read", "events:write"],
  finanzas: [
    "projects:read",
    "parcels:read",
    "billing:read",
    "billing:write",
    "finance:read",
    "finance:write",
  ],
  corredor: ["projects:read", "parcels:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
