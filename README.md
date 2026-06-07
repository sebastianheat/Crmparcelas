# 5000

> CRM/RP vertical 100% especializado en la **venta de parcelas en Chile** (parcelas de agrado bajo DL 3516 — mínimo **5.000 m²**, de ahí el nombre). El sistema operativo de la empresa parceladora: CRM, stock, prefacturación e IA. **5000.cl · by HEAT.**

Especificación completa del producto en [`docs/5000_Spec.md`](docs/5000_Spec.md) e inteligencia de mercado en [`docs/5000_Repositorio_Referencia.md`](docs/5000_Repositorio_Referencia.md).

## Estado actual

- **Multi-tenant con aislamiento real** — `tenant_id` + Row-Level Security en Postgres. La app conecta con un rol restringido; migraciones/seed con el rol owner.
- **Autenticación y roles** (Auth.js). Set completo: CEO/Super Admin, Gerente Comercial, Jefe de Ventas, Vendedor, Gerente de Finanzas, Contador, Cajero, Legal, Marketing, Corredor — con permisos por capacidad.
- **Equipo** (`/app/equipo`): crear usuarios y asignar rol.
- **M1 — Proyectos y Stock**: badge de estado, atributos, stock de parcelas; **datos de adquisición** (predio, plano, deslindes, fojas/n°/año CBR, rol SII, subdivisión SAG); **documentos de adquisición + extracción con Claude** (PDF/imagen → autocompleta datos legales); **estado legal, riesgo, propio/ajeno, denuncias** (portafolio).
- **M2 — Documentación legal**: historial inmutable de la parcela (append-only + trigger); **sociedades vendedoras**; **matriz de promesa configurable** (editable por legal) + **generación de la promesa con IA** (PDF y **Word**); repositorio documental por parcela; **firma electrónica** (interfaz `SignatureProvider`, mock).
- **M3 — Finanzas**: **prefacturación** (comprobante → factura exenta, interfaz `DTEProvider`); **validación de reservas** con foto de comprobante obligatoria → PDF; **cobranza / plan de pagos** (crédito directo: pie + cuotas, vencimientos, dashboard `/app/cobranza`).
- **M9 — Dashboard financiero + portafolio** — ingresado/prometido/escriturado, margen, estado legal y riesgo por proyecto.
- **Clientes** con datos legales (para la promesa).
- **Landing pública + mapa de stock** compartible por URL (`/p/[tenant]/[project]`).
- **IA (Claude)** — copy de landing, extracción de documentos y redacción/corrección de promesas.
- **Almacenamiento** vía `storeFile` — Vercel Blob si está configurado, si no Postgres (`/api/files`).

Proceso legal del rubro documentado en [`docs/Proceso_Legal_Parcelas.md`](docs/Proceso_Legal_Parcelas.md).
Próximas fases (CRM/embudo, agente IA WhatsApp, comisiones, contenido, Ads, marketplace) en §11 del spec.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript + Tailwind 4
- **Postgres** + **Drizzle ORM** (con RLS por tenant)
- **Auth.js** (credenciales + JWT)
- **Anthropic Claude** para generación de texto
- Dominio: **5000.cl** · Deploy objetivo: **Vercel**

## Puesta en marcha (local)

Requisitos: Node 20.9+, pnpm, Postgres 16.

```bash
pnpm install
cp .env.example .env.local            # ajusta credenciales si hace falta

# Rol de aplicación (RLS), migraciones y datos demo
createdb 5000                         # o CREATE DATABASE "5000";
pnpm db:migrate
psql "$DATABASE_ADMIN_URL" -f scripts/setup-roles.sql
pnpm db:seed

pnpm dev                              # http://localhost:3000
```

**Login demo:** `admin@5000.cl` · `Cincomil2026`

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
