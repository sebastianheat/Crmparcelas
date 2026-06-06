/**
 * 5000 — Esquema de datos (Fase 1 / MVP)
 *
 * Principios de diseño:
 *  - Multi-tenant desde el día uno. Cada fila de negocio lleva `tenantId`.
 *    El aislamiento real se refuerza con Row-Level Security (ver drizzle/0000_rls.sql).
 *  - Historial inmutable por parcela: la tabla `parcelEvents` es append-only
 *    (reserva → devolución → promesa → resciliación → escritura → inscripción → entrega).
 *    `parcels.status` es solo una caché del último estado para listar rápido.
 *  - Moneda: CLP siempre. El precio "Desde" del proyecto puede expresarse en UF o CLP.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "super_admin",
  "gerente_legal",
  "gerente_marketing",
  "jefe_ventas",
  "vendedor",
  "finanzas",
  "corredor",
  // Set completo (Fase 2): jerarquía comercial y de finanzas.
  "gerente_comercial",
  "gerente_finanzas",
  "contador",
  "cajero",
]);

/** Badge de estado del proyecto (Anexo C.5 del spec). */
export const projectStatusEnum = pgEnum("project_status", [
  "proximo_lanzamiento",
  "en_verde",
  "etapa",
  "entrega_inmediata",
  "escriturable",
  "nuevo",
  "vendido_100",
]);

/** Estado actual (caché) de una parcela. La verdad vive en parcelEvents. */
export const parcelStatusEnum = pgEnum("parcel_status", [
  "disponible",
  "reservada",
  "prometida",
  "resciliada",
  "escriturada",
  "inscrita",
  "entregada",
  "bloqueada",
]);

/** Tipos de evento del historial inmutable de la parcela (§3.3). */
export const parcelEventTypeEnum = pgEnum("parcel_event_type", [
  "reserva",
  "devolucion_reserva",
  "promesa",
  "resciliacion",
  "nueva_promesa",
  "escritura",
  "inscripcion_cbr",
  "entrega",
  "reparo",
  "vale_vista",
  "bloqueo",
  "desbloqueo",
  "cambio_precio",
]);

export const priceUnitEnum = pgEnum("price_unit", ["clp", "uf"]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "contado",
  "credito_directo",
  "pie",
]);

export const accessTypeEnum = pgEnum("access_type", [
  "asfaltado",
  "estabilizado",
  "tierra",
]);

/** Comprobante de dinero / prefactura (M3, el diferenciador). */
export const voucherStatusEnum = pgEnum("voucher_status", [
  "registrado", // pendiente de validación por finanzas
  "anulado",
  "facturado",
  "validado", // finanzas confirmó el dinero con comprobante → PDF emitido
]);

/** Factura exenta (M3). */
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "borrador",
  "emitida",
  "anulada",
]);

export const costCategoryEnum = pgEnum("cost_category", [
  "marketing",
  "terreno",
  "obras",
  "legal",
  "comisiones",
  "operacional",
  "otros",
]);

export const billingTermEnum = pgEnum("billing_term", [
  "mensual",
  "anual_net90",
]);

// ─── Tenants (inmobiliarias) ──────────────────────────────────────────────────

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    rut: text("rut"),
    // Identidad visual propagada a landings/brochures/contenido generado.
    brandPrimary: text("brand_primary").default("#1f7a4d").notNull(),
    brandSecondary: text("brand_secondary").default("#0f172a").notNull(),
    logoUrl: text("logo_url"),
    // Modelo de negocio (§4.1).
    isFounder: boolean("is_founder").default(false).notNull(),
    billingTerm: billingTermEnum("billing_term").default("mensual").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("tenants_slug_uk").on(t.slug)],
);

// ─── Usuarios y membresías (auth, globales) ───────────────────────────────────
// Estas tablas NO llevan RLS por tenant: el login ocurre antes de elegir tenant.

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("users_email_uk").on(t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("memberships_user_tenant_uk").on(t.userId, t.tenantId),
    index("memberships_tenant_idx").on(t.tenantId),
  ],
);

// ─── Clientes / Leads (mínimo en Fase 1; CRM completo = Fase 2) ────────────────

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rut: text("rut"),
    phone: text("phone"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("clients_tenant_idx").on(t.tenantId)],
);

// ─── M1 — Proyectos ───────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subBrand: text("sub_brand"),
    slug: text("slug").notNull(), // para landing/mapa compartible por URL
    // Ubicación (comuna/provincia/región).
    comuna: text("comuna"),
    provincia: text("provincia"),
    region: text("region"),
    lat: numeric("lat", { precision: 10, scale: 6 }),
    lng: numeric("lng", { precision: 10, scale: 6 }),
    // Precio "Desde" (CLP o UF).
    priceFrom: numeric("price_from", { precision: 14, scale: 2 }),
    priceUnit: priceUnitEnum("price_unit").default("clp").notNull(),
    status: projectStatusEnum("status").default("proximo_lanzamiento").notNull(),
    description: text("description"),
    // Atributos para publicidad/speech (M1): factibilidad, entorno, cercanías.
    accessType: accessTypeEnum("access_type"),
    factibilidad: jsonb("factibilidad")
      .$type<{
        luz?: boolean;
        aguaPotable?: boolean;
        aguaRegadio?: boolean;
        iluminacionCaminos?: boolean;
        portonAutomatico?: boolean;
      }>()
      .default({}),
    entorno: jsonb("entorno").$type<string[]>().default([]),
    cercanias: jsonb("cercanias")
      .$type<{ nombre: string; minutos?: number }[]>()
      .default([]),
    paymentMethods: jsonb("payment_methods")
      .$type<("contado" | "credito_directo" | "pie")[]>()
      .default([]),
    galleryUrls: jsonb("gallery_urls").$type<string[]>().default([]),
    videoUrl: text("video_url"),
    tour360Url: text("tour_360_url"),
    mapKmzUrl: text("map_kmz_url"),
    // Contenido generado por IA (M6 light): copy de landing y brochure.
    landingCopy: text("landing_copy"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("projects_tenant_idx").on(t.tenantId),
    uniqueIndex("projects_tenant_slug_uk").on(t.tenantId, t.slug),
  ],
);

// ─── M1 — Stock de parcelas ───────────────────────────────────────────────────

export const parcels = pgTable(
  "parcels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // N° de lote
    prerrol: text("prerrol"), // certificado SII de pre-enrolamiento
    rol: text("rol"), // rol definitivo cuando exista
    areaM2: numeric("area_m2", { precision: 12, scale: 2 }),
    price: numeric("price", { precision: 14, scale: 2 }),
    priceUnit: priceUnitEnum("price_unit").default("clp").notNull(),
    status: parcelStatusEnum("status").default("disponible").notNull(),
    currentClientId: uuid("current_client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    deslindes: text("deslindes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("parcels_tenant_idx").on(t.tenantId),
    index("parcels_project_idx").on(t.projectId),
    uniqueIndex("parcels_project_code_uk").on(t.projectId, t.code),
  ],
);

// ─── M2 — Historial inmutable de la parcela (append-only) ─────────────────────

export const parcelEvents = pgTable(
  "parcel_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parcelId: uuid("parcel_id")
      .notNull()
      .references(() => parcels.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: parcelEventTypeEnum("type").notNull(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    // Dinero que ingresa con el evento (anticipo, reserva). CLP.
    amountClp: numeric("amount_clp", { precision: 14, scale: 2 }),
    // Código/repertorio de la escritura: gatillo de la venta exenta (M3).
    repertorioCode: text("repertorio_code"),
    // Condiciones (plazos, obras), vale vista, etc.
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    note: text("note"),
    // Vendedor del equipo responsable del movimiento (puede diferir de quien lo
    // registra: un jefe puede cargar la reserva de un vendedor).
    sellerUserId: uuid("seller_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("parcel_events_tenant_idx").on(t.tenantId),
    index("parcel_events_parcel_idx").on(t.parcelId),
    index("parcel_events_project_idx").on(t.projectId),
  ],
);

// ─── M3 — Comprobantes de dinero / prefactura ─────────────────────────────────

export const moneyVouchers = pgTable(
  "money_vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parcelId: uuid("parcel_id")
      .notNull()
      .references(() => parcels.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    parcelEventId: uuid("parcel_event_id").references(() => parcelEvents.id, {
      onDelete: "set null",
    }),
    folio: integer("folio").notNull(), // correlativo por tenant
    concept: text("concept").notNull(),
    amountClp: numeric("amount_clp", { precision: 14, scale: 2 }).notNull(),
    status: voucherStatusEnum("status").default("registrado").notNull(),
    // Vendedor responsable de la reserva/venta (M8 comisiones).
    sellerUserId: uuid("seller_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Validación por finanzas: foto del comprobante de depósito/transferencia
    // (obligatoria) y PDF de la reserva generado al validar.
    proofUrl: text("proof_url"),
    pdfUrl: text("pdf_url"),
    validatedByUserId: uuid("validated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("vouchers_tenant_idx").on(t.tenantId),
    index("vouchers_project_idx").on(t.projectId),
    index("vouchers_parcel_idx").on(t.parcelId),
    uniqueIndex("vouchers_tenant_folio_uk").on(t.tenantId, t.folio),
  ],
);

// ─── M3 — Facturas exentas (DTE) ──────────────────────────────────────────────

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parcelId: uuid("parcel_id")
      .notNull()
      .references(() => parcels.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    voucherId: uuid("voucher_id").references(() => moneyVouchers.id, {
      onDelete: "set null",
    }),
    folio: integer("folio"),
    // Factura exenta: el total va como monto exento, IVA = 0.
    exemptClp: numeric("exempt_clp", { precision: 14, scale: 2 }).notNull(),
    totalClp: numeric("total_clp", { precision: 14, scale: 2 }).notNull(),
    repertorioCode: text("repertorio_code"), // gatillo de venta (M2)
    status: invoiceStatusEnum("status").default("borrador").notNull(),
    // Trazabilidad del proveedor DTE.
    dteProvider: text("dte_provider"),
    dteTrackId: text("dte_track_id"),
    dteStatus: text("dte_status"),
    factored: boolean("factored").default(false).notNull(), // factoring (§4.1)
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("invoices_tenant_idx").on(t.tenantId),
    index("invoices_project_idx").on(t.projectId),
  ],
);

// ─── M9 — Costos (para utilidad por proyecto) ─────────────────────────────────

export const costs = pgTable(
  "costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    category: costCategoryEnum("category").notNull(),
    amountClp: numeric("amount_clp", { precision: 14, scale: 2 }).notNull(),
    description: text("description"),
    incurredAt: timestamp("incurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("costs_tenant_idx").on(t.tenantId),
    index("costs_project_idx").on(t.projectId),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  tenant: one(tenants, {
    fields: [memberships.tenantId],
    references: [tenants.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [projects.tenantId],
    references: [tenants.id],
  }),
  parcels: many(parcels),
}));

export const parcelsRelations = relations(parcels, ({ one, many }) => ({
  project: one(projects, {
    fields: [parcels.projectId],
    references: [projects.id],
  }),
  currentClient: one(clients, {
    fields: [parcels.currentClientId],
    references: [clients.id],
  }),
  events: many(parcelEvents),
}));

export const parcelEventsRelations = relations(parcelEvents, ({ one }) => ({
  parcel: one(parcels, {
    fields: [parcelEvents.parcelId],
    references: [parcels.id],
  }),
  client: one(clients, {
    fields: [parcelEvents.clientId],
    references: [clients.id],
  }),
}));

// ─── Tipos inferidos ──────────────────────────────────────────────────────────

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Parcel = typeof parcels.$inferSelect;
export type NewParcel = typeof parcels.$inferInsert;
export type ParcelEvent = typeof parcelEvents.$inferSelect;
export type ParcelEventType = (typeof parcelEventTypeEnum.enumValues)[number];
export type MoneyVoucher = typeof moneyVouchers.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Cost = typeof costs.$inferSelect;
export type Client = typeof clients.$inferSelect;

/** Tablas de negocio sujetas a Row-Level Security por tenant. */
export const TENANT_SCOPED_TABLES = [
  "clients",
  "projects",
  "parcels",
  "parcel_events",
  "money_vouchers",
  "invoices",
  "costs",
] as const;

export { sql };
