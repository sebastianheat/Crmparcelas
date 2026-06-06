/**
 * Seed de datos demo. Crea una inmobiliaria (tenant), un super admin y un par
 * de proyectos con stock, historial, comprobantes y costos, inspirados en los
 * proyectos reales del anexo (Toscana: Valle Codegua, Valle Curicó).
 *
 * Corre con el rol OWNER (DATABASE_ADMIN_URL): omite RLS, lo cual simplifica el
 * tooling. La app en runtime usa el rol restringido (DATABASE_URL).
 *
 * Ejecutar: pnpm db:seed
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  clients,
  costs,
  memberships,
  moneyVouchers,
  parcelEvents,
  parcels,
  projects,
  tenants,
  users,
} from "./schema";
import * as schema from "./schema";

const DEMO_SLUG = "toscana";
const ADMIN_EMAIL = "admin@5000.cl";
const ADMIN_PASSWORD = "Cincomil2026";

const adminUrl =
  process.env.DATABASE_ADMIN_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;
if (!adminUrl) throw new Error("Define DATABASE_ADMIN_URL o DATABASE_URL");

const sqlClient = postgres(adminUrl, { max: 1, prepare: false });
const db = drizzle(sqlClient, { schema });

async function main() {
  console.log("🌱 Sembrando datos demo…");

  // Limpiar tenant demo previo (cascade). Habilitamos borrado del historial
  // inmutable solo para esta purga controlada.
  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, DEMO_SLUG),
  });
  if (existing) {
    await db.transaction(async (tx) => {
      // Contexto requerido por RLS para que el cascade borre filas del tenant.
      await tx.execute(sql`select set_config('app.allow_event_delete','on',true)`);
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${existing.id}, true)`,
      );
      await tx.delete(tenants).where(eq(tenants.id, existing.id));
    });
    console.log("  · Tenant demo anterior eliminado.");
  }

  // 1) Tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      slug: DEMO_SLUG,
      name: "Inmobiliaria Toscana",
      rut: "76.123.456-7",
      brandPrimary: "#1f7a4d",
      brandSecondary: "#0f172a",
      isFounder: true,
    })
    .returning();

  // 2) Usuario super admin (+ membresía)
  const passwordHash = await hash(ADMIN_PASSWORD, 10);
  const [user] = await db
    .insert(users)
    .values({ email: ADMIN_EMAIL, name: "Sebastián Yáñez", passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, name: "Sebastián Yáñez" },
    })
    .returning();

  await db.delete(memberships).where(eq(memberships.userId, user.id));
  await db.insert(memberships).values({
    userId: user.id,
    tenantId: tenant.id,
    role: "super_admin",
  });

  // Fijar el contexto de tenant (sesión) para que las inserciones de negocio
  // pasen las políticas RLS aunque el rol no sea superusuario (caso Neon).
  await db.execute(
    sql`select set_config('app.current_tenant_id', ${tenant.id}, false)`,
  );

  // 3) Clientes
  const insertedClients = await db
    .insert(clients)
    .values([
      {
        tenantId: tenant.id,
        name: "María González",
        rut: "12.345.678-9",
        phone: "+56 9 1111 1111",
        email: "maria@example.cl",
      },
      {
        tenantId: tenant.id,
        name: "Juan Pérez",
        rut: "9.876.543-2",
        phone: "+56 9 2222 2222",
        email: "juan@example.cl",
      },
    ])
    .returning();

  // 4) Proyecto 1 — Valle Codegua (Entrega Inmediata)
  const [codegua] = await db
    .insert(projects)
    .values({
      tenantId: tenant.id,
      name: "Valle Codegua",
      subBrand: "Toscana",
      slug: "valle-codegua",
      comuna: "Codegua",
      provincia: "Cachapoal",
      region: "O'Higgins",
      priceFrom: "14990000",
      priceUnit: "clp",
      status: "entrega_inmediata",
      accessType: "asfaltado",
      description:
        "Parcelas de agrado en pleno Valle de Codegua, a minutos de la ciudad.",
      factibilidad: {
        luz: true,
        aguaPotable: true,
        aguaRegadio: true,
        portonAutomatico: true,
      },
      entorno: ["cerro", "vinas"],
      cercanias: [
        { nombre: "Rancagua", minutos: 25 },
        { nombre: "Santiago", minutos: 75 },
      ],
      paymentMethods: ["contado", "credito_directo", "pie"],
    })
    .returning();

  // 5) Proyecto 2 — Valle Curicó (En Verde / Escriturable)
  const [curico] = await db
    .insert(projects)
    .values({
      tenantId: tenant.id,
      name: "Valle Curicó",
      subBrand: "Toscana",
      slug: "valle-curico",
      comuna: "Curicó",
      provincia: "Curicó",
      region: "Maule",
      priceFrom: "26990000",
      priceUnit: "clp",
      status: "escriturable",
      accessType: "estabilizado",
      description: "Proyecto en verde, escriturable, rodeado de naturaleza.",
      factibilidad: { luz: true, aguaPotable: true },
      entorno: ["bosque_nativo", "rio"],
      cercanias: [{ nombre: "Curicó", minutos: 20 }],
      paymentMethods: ["contado", "pie"],
    })
    .returning();

  // 6) Stock
  const codeguaParcels = await db
    .insert(parcels)
    .values(
      Array.from({ length: 8 }, (_, i) => ({
        tenantId: tenant.id,
        projectId: codegua.id,
        code: `C-${String(i + 1).padStart(2, "0")}`,
        prerrol: `PR-CDG-${1000 + i}`,
        areaM2: "5000",
        price: String(14990000 + i * 500000),
        priceUnit: "clp" as const,
        status: "disponible" as const,
      })),
    )
    .returning();

  await db.insert(parcels).values(
    Array.from({ length: 6 }, (_, i) => ({
      tenantId: tenant.id,
      projectId: curico.id,
      code: `CU-${String(i + 1).padStart(2, "0")}`,
      prerrol: `PR-CUR-${2000 + i}`,
      areaM2: "5000",
      price: String(26990000 + i * 800000),
      priceUnit: "clp" as const,
      status: "disponible" as const,
    })),
  );

  // 7) Historial: C-01 reservada → prometida con anticipo.
  const p1 = codeguaParcels[0];
  const [reservaEvent] = await db
    .insert(parcelEvents)
    .values({
      tenantId: tenant.id,
      parcelId: p1.id,
      projectId: codegua.id,
      type: "reserva",
      clientId: insertedClients[0].id,
      amountClp: "300000",
      note: "Reserva tomada en visita a terreno.",
      createdByUserId: user.id,
    })
    .returning();

  const [promesaEvent] = await db
    .insert(parcelEvents)
    .values({
      tenantId: tenant.id,
      parcelId: p1.id,
      projectId: codegua.id,
      type: "promesa",
      clientId: insertedClients[0].id,
      amountClp: "4500000",
      note: "Promesa de compraventa firmada. Pie 30%.",
      payload: { piePct: 30, obras: ["caminos", "luz", "agua"] },
      createdByUserId: user.id,
    })
    .returning();

  await db
    .update(parcels)
    .set({ status: "prometida", currentClientId: insertedClients[0].id })
    .where(eq(parcels.id, p1.id));

  // 8) Comprobantes de dinero (prefactura) ligados a los eventos.
  await db.insert(moneyVouchers).values([
    {
      tenantId: tenant.id,
      projectId: codegua.id,
      parcelId: p1.id,
      clientId: insertedClients[0].id,
      parcelEventId: reservaEvent.id,
      folio: 1,
      concept: "Reserva parcela C-01",
      amountClp: "300000",
      createdByUserId: user.id,
    },
    {
      tenantId: tenant.id,
      projectId: codegua.id,
      parcelId: p1.id,
      clientId: insertedClients[0].id,
      parcelEventId: promesaEvent.id,
      folio: 2,
      concept: "Pie promesa parcela C-01",
      amountClp: "4500000",
      createdByUserId: user.id,
    },
  ]);

  // 9) Costos por proyecto (para utilidad en M9).
  await db.insert(costs).values([
    {
      tenantId: tenant.id,
      projectId: codegua.id,
      category: "terreno",
      amountClp: "60000000",
      description: "Compra del campo (10 ha).",
      createdByUserId: user.id,
    },
    {
      tenantId: tenant.id,
      projectId: codegua.id,
      category: "marketing",
      amountClp: "7200000",
      description: "Campañas Meta/Google (mes).",
      createdByUserId: user.id,
    },
    {
      tenantId: tenant.id,
      projectId: curico.id,
      category: "terreno",
      amountClp: "90000000",
      description: "Compra del campo.",
      createdByUserId: user.id,
    },
  ]);

  console.log("✅ Seed completo.");
  console.log(`   Login:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
}

main()
  .then(() => sqlClient.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("❌ Error en seed:", err);
    await sqlClient.end();
    process.exit(1);
  });
