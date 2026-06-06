@AGENTS.md

# 5000 — contexto para Claude Code

CRM vertical para venta de parcelas en Chile (DL 3516). Marca: **5000** (dominio
`5000.cl`, by HEAT) — por los 5.000 m² mínimos de una parcela de agrado. Lee
`docs/5000_Spec.md` (PRD, decisiones cerradas) antes de cambios de producto.
Idioma: español (Chile).

## Reglas del proyecto

- **Multi-tenant siempre.** Toda tabla de negocio lleva `tenant_id` y está bajo RLS.
  Accede a datos de negocio mediante `withCurrentTenant()` (src/lib/session.ts) o
  `withTenant()` (src/db/tenant.ts); nunca uses `db` directo para tablas de tenant.
- **La app conecta con el rol `app_user`** (no superusuario) para que RLS aplique.
  Migraciones y seed usan `DATABASE_ADMIN_URL` (rol owner).
- **Historial de parcela = append-only.** Nunca edites/borres `parcel_events`; agrega
  un evento nuevo. El trigger en la BD lo refuerza.
- **Moneda CLP siempre.** Venta de parcelas exenta de IVA; el SaaS sí lleva IVA.
- **IA de texto = API de Anthropic (Claude).** Ver src/lib/ai/claude.ts.
- **Factura electrónica vía interfaz `DTEProvider`** (src/lib/dte). No acoplar a un
  proveedor concreto.

## Comandos

- BD: `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:generate` (tras tocar el esquema).
- Verificar: `pnpm build` (incluye type-check). Postgres debe estar arriba.

## Stack

Next.js 16 (App Router, Turbopack, `params`/`cookies` async, `proxy.ts` en vez de
`middleware`), React 19, Drizzle, Auth.js, Tailwind 4.
