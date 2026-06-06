# Parcelasy

> CRM/RP vertical 100% especializado en la **venta de parcelas en Chile** (parcelas de agrado bajo DL 3516). El sistema operativo de la empresa parceladora: CRM, stock, prefacturación e IA. **by HEAT.**

Especificación completa del producto en [`docs/Parcelasy_Spec.md`](docs/Parcelasy_Spec.md) e inteligencia de mercado en [`docs/Parcelasy_Repositorio_Referencia.md`](docs/Parcelasy_Repositorio_Referencia.md).

## Estado: Fase 1 (MVP) — el núcleo de orden

Implementado en este hito:

- **Multi-tenant con aislamiento real** — `tenant_id` + Row-Level Security en Postgres. La app conecta con un rol restringido; las migraciones/seed con el rol owner.
- **Autenticación y roles** (Auth.js, 7 roles del rubro con permisos por capacidad).
- **M1 — Proyectos y Stock** — proyectos con badge de estado, atributos (acceso, factibilidad, entorno, cercanías) y stock de parcelas.
- **M2 (base) — Historial inmutable de la parcela** — tabla append-only (reserva → promesa → resciliación → escritura → inscripción → entrega), protegida por trigger.
- **M3 — Prefacturación** — comprobante de dinero → factura exenta, con interfaz `DTEProvider` (mock; lista para OpenFactura/LibreDTE/SimpleAPI).
- **M9 — Dashboard financiero** — ingresado vs prometido vs escriturado y margen por proyecto.
- **IA (Claude)** — generación del copy de landing por proyecto con el speech de 5 pasos del rubro.

Próximas fases (CRM/embudo, agente IA WhatsApp, comisiones, contenido, Ads, marketplace) en el roadmap del spec (§11).

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript + Tailwind 4
- **Postgres** + **Drizzle ORM** (con RLS por tenant)
- **Auth.js** (credenciales + JWT)
- **Anthropic Claude** para generación de texto
- Deploy objetivo: **Vercel**

## Puesta en marcha (local)

Requisitos: Node 20.9+, pnpm, Postgres 16.

```bash
pnpm install
cp .env.example .env.local            # ajusta credenciales si hace falta

# Rol de aplicación (RLS), migraciones y datos demo
createdb parcelasy                    # o CREATE DATABASE parcelasy;
pnpm db:migrate
psql "$DATABASE_ADMIN_URL" -f scripts/setup-roles.sql
pnpm db:seed

pnpm dev                              # http://localhost:3000
```

**Login demo:** `admin@parcelasy.cl` · `Parcelasy2026`

> En sesiones de Claude Code en la web, el hook `.claude/hooks/session-start.sh` provisiona Postgres + migraciones + seed automáticamente.

## Scripts

| Script | Descripción |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm db:generate` | Genera migración desde el esquema |
| `pnpm db:migrate` | Aplica migraciones |
| `pnpm db:seed` | Datos demo (Inmobiliaria Toscana) |
| `pnpm db:studio` | Drizzle Studio |

## Arquitectura

- `src/db/schema.ts` — esquema Drizzle. `drizzle/0001_rls.sql` — políticas RLS y trigger append-only.
- `src/db/tenant.ts` — `withTenant()` fija `app.current_tenant_id` por transacción (contexto RLS).
- `src/lib/session.ts` — `withCurrentTenant()` y guardas de permisos.
- `src/server/queries.ts` (lectura) y `src/server/actions.ts` (mutaciones).
- `src/lib/dte/` — abstracción de proveedor de factura electrónica.
- `src/app/app/*` — UI protegida (dashboard, proyectos, prefacturación, costos).

**Moneda:** CLP siempre. La venta de parcelas es **exenta de IVA**; el SaaS sí lleva IVA.
