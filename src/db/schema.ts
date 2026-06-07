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
  customType,
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

/** Tipo binario de Postgres (para guardar archivos cuando no hay Blob externo). */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

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

/** Estado legal del proyecto (ciclo SAG → CBR), observado en el portafolio real. */
export const legalStatusEnum = pgEnum("legal_status", [
  "sin_definir",
  "sag_ingresado", // ingresado al SAG, en proceso de subdivisión
  "sag_certificado", // subdivisión certificada por el SAG
  "en_inscripcion", // en proceso de inscripción en el CBR
  "inscrito", // subdivisión inscrita, lotes transferibles
]);

export const riesgoEnum = pgEnum("riesgo", ["bajo", "medio", "alto"]);

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
    // Tasa de comisión del vendedor (%) sobre cobros atribuidos (M8).
    commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("memberships_user_tenant_uk").on(t.userId, t.tenantId),
    index("memberships_tenant_idx").on(t.tenantId),
  ],
);

// ─── Archivos (fallback de almacenamiento sin Vercel Blob) ────────────────────
// Si BLOB_READ_WRITE_TOKEN existe, los archivos van a Vercel Blob; si no, se
// guardan aquí (bytea) y se sirven por /api/files/[id]. Ver src/lib/storage.ts.

export const blobs = pgTable(
  "blobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    filename: text("filename"),
    mime: text("mime").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("blobs_tenant_idx").on(t.tenantId)],
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
    phone2: text("phone2"),
    email: text("email"),
    // Datos legales para formar la promesa de compraventa (M2).
    direccion: text("direccion"),
    profesion: text("profesion"),
    estadoCivil: text("estado_civil"),
    nacionalidad: text("nacionalidad").default("chilena"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("clients_tenant_idx").on(t.tenantId)],
);

// ─── Sociedades vendedoras (por tenant) ──────────────────────────────────────
// Una inmobiliaria opera con varias sociedades (la promitente vendedora de cada
// promesa/escritura). Datos para la comparecencia y personería de la promesa.

export const sellerCompanies = pgTable(
  "seller_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    razonSocial: text("razon_social").notNull(),
    rut: text("rut"),
    repNombre: text("rep_nombre"),
    repCI: text("rep_ci"),
    repNacionalidad: text("rep_nacionalidad").default("chilena"),
    repEstadoCivil: text("rep_estado_civil"),
    repProfesion: text("rep_profesion"),
    domicilio: text("domicilio"),
    // Personería del representante.
    personeriaNotaria: text("personeria_notaria"),
    personeriaRepertorio: text("personeria_repertorio"),
    personeriaFecha: text("personeria_fecha"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("seller_companies_tenant_idx").on(t.tenantId)],
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
    // Sociedad vendedora por defecto del proyecto (promitente vendedora).
    sellerCompanyId: uuid("seller_company_id").references(
      () => sellerCompanies.id,
      { onDelete: "set null" },
    ),
    // Notaría donde se firma (para promesa/escritura).
    notaria: text("notaria"),
    // Gestión de portafolio (según el Excel real "Proyectos Mundo SpA").
    legalStatus: legalStatusEnum("legal_status").default("sin_definir").notNull(),
    riesgo: riesgoEnum("riesgo").default("bajo").notNull(),
    propio: boolean("propio").default(true).notNull(), // propio vs ajeno (consignación)
    denuncias: integer("denuncias").default(0).notNull(),
    legalNotes: text("legal_notes"),
    // Datos de adquisición del campo, extraídos de la carpeta legal (M1).
    // Alimentan las cláusulas PRIMERO/SEGUNDO de la promesa (ver docs/Proceso_Legal_Parcelas.md).
    acquisition: jsonb("acquisition")
      .$type<{
        predioDenominacion?: string; // "Resto del Lote A, Hijuela Dos, Fundo La Cruz"
        subdelegacion?: string;
        planoArchivoN?: string; // N° plano archivado
        planoCbr?: string;
        planoAnio?: string;
        superficie?: string; // ej. "54,50 hectáreas"
        deslindes?: { norte?: string; sur?: string; oriente?: string; poniente?: string };
        dominioFojas?: string;
        dominioNumero?: string;
        dominioAnio?: string;
        dominioCbr?: string;
        rolSii?: string; // rol del predio madre
        // Subdivisión SAG
        subdivisionNLotes?: string;
        sagCertN?: string; // ej. "1511/2023"
        sagFecha?: string;
        archivoCertSag?: string;
        archivoRoles?: string;
        archivoPlano?: string;
        aguas?: string; // derechos de aprovechamiento
      }>()
      .default({}),
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

/** Tipos de documento del repositorio por parcela (M2). */
export const parcelDocTypeEnum = pgEnum("parcel_doc_type", [
  "promesa",
  "escritura",
  "cesion",
  "resciliacion",
  "comprobante",
  "otro",
]);

/** Tipos de documento de adquisición del proyecto (M1). */
export const projectDocTypeEnum = pgEnum("project_doc_type", [
  "compraventa",
  "inscripcion_cbr",
  "certificado_sag",
  "asignacion_roles",
  "plano",
  "aguas",
  "estudio_titulos",
  "otro",
]);

// ─── M1 — Documentos de adquisición del proyecto ──────────────────────────────

export const projectDocuments = pgTable(
  "project_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: projectDocTypeEnum("type").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    mime: text("mime"),
    extracted: boolean("extracted").default(false).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("project_documents_tenant_idx").on(t.tenantId),
    index("project_documents_project_idx").on(t.projectId),
  ],
);

// ─── M2 — Repositorio documental por parcela ──────────────────────────────────

export const parcelDocuments = pgTable(
  "parcel_documents",
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
    type: parcelDocTypeEnum("type").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    // Estado del flujo legal: borrador → revisión abogado → firmado/notaría.
    status: text("status").default("borrador").notNull(),
    generatedByAi: boolean("generated_by_ai").default(false).notNull(),
    // Export Word + firma electrónica (M2).
    docxUrl: text("docx_url"),
    signatureProvider: text("signature_provider"),
    signatureStatus: text("signature_status"), // enviado | firmado | rechazado
    signatureRef: text("signature_ref"),
    signedUrl: text("signed_url"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("parcel_documents_tenant_idx").on(t.tenantId),
    index("parcel_documents_parcel_idx").on(t.parcelId),
  ],
);

// ─── M3 — Cobranza / plan de pagos (crédito directo) ──────────────────────────

export const installmentStatusEnum = pgEnum("installment_status", [
  "pendiente",
  "pagada",
  "vencida",
  "condonada",
]);

export const paymentPlans = pgTable(
  "payment_plans",
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
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    totalClp: numeric("total_clp", { precision: 14, scale: 2 }).notNull(),
    pieClp: numeric("pie_clp", { precision: 14, scale: 2 }).default("0"),
    nCuotas: integer("n_cuotas").notNull(),
    status: text("status").default("vigente").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("payment_plans_tenant_idx").on(t.tenantId),
    index("payment_plans_parcel_idx").on(t.parcelId),
  ],
);

export const installments = pgTable(
  "installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => paymentPlans.id, { onDelete: "cascade" }),
    parcelId: uuid("parcel_id")
      .notNull()
      .references(() => parcels.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    amountClp: numeric("amount_clp", { precision: 14, scale: 2 }).notNull(),
    status: installmentStatusEnum("status").default("pendiente").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voucherId: uuid("voucher_id").references(() => moneyVouchers.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("installments_tenant_idx").on(t.tenantId),
    index("installments_plan_idx").on(t.planId),
    index("installments_parcel_idx").on(t.parcelId),
  ],
);

// ─── M2 — Matrices de promesa (editables por el área legal) ───────────────────

export const promesaTemplates = pgTable(
  "promesa_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: text("content").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("promesa_templates_tenant_idx").on(t.tenantId)],
);

// ─── Fase 2 — CRM: leads y embudo de ventas ──────────────────────────────────

export const leadStageEnum = pgEnum("lead_stage", [
  "nuevo",
  "contactado",
  "calificado",
  "visita",
  "negociacion",
  "ganado",
  "perdido",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "web",
  "whatsapp",
  "instagram",
  "facebook",
  "portal",
  "referido",
  "otro",
]);

export const leadActivityTypeEnum = pgEnum("lead_activity_type", [
  "nota",
  "llamada",
  "whatsapp",
  "email",
  "visita",
  "cambio_etapa",
]);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    source: leadSourceEnum("source").default("web").notNull(),
    stage: leadStageEnum("stage").default("nuevo").notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    estimatedValueClp: numeric("estimated_value_clp", {
      precision: 14,
      scale: 2,
    }),
    notes: text("notes"),
    lostReason: text("lost_reason"),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("leads_tenant_idx").on(t.tenantId),
    index("leads_stage_idx").on(t.stage),
    index("leads_assigned_idx").on(t.assignedToUserId),
  ],
);

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: leadActivityTypeEnum("type").default("nota").notNull(),
    note: text("note"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("lead_activities_tenant_idx").on(t.tenantId),
    index("lead_activities_lead_idx").on(t.leadId),
  ],
);

// ─── M3 — Conciliación bancaria (open banking: Fintoc) ────────────────────────

export const bankMovementStatusEnum = pgEnum("bank_movement_status", [
  "pendiente",
  "conciliado",
  "ignorado",
]);

export const bankMovements = pgTable(
  "bank_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("mock"),
    externalId: text("external_id").notNull(), // id del movimiento en el banco
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    // CLP con signo: positivo = abono (entra), negativo = cargo (sale).
    amountClp: numeric("amount_clp", { precision: 14, scale: 2 }).notNull(),
    description: text("description"),
    counterparty: text("counterparty"), // nombre/RUT del remitente
    status: bankMovementStatusEnum("status").default("pendiente").notNull(),
    matchedVoucherId: uuid("matched_voucher_id").references(
      () => moneyVouchers.id,
      { onDelete: "set null" },
    ),
    raw: jsonb("raw").$type<Record<string, unknown>>().default({}),
    reconciledByUserId: uuid("reconciled_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("bank_movements_tenant_idx").on(t.tenantId),
    uniqueIndex("bank_movements_external_uk").on(t.tenantId, t.externalId),
  ],
);

// ─── M2 — Causas legales (querellas / denuncias por parcela o cliente) ────────

export const legalCaseTypeEnum = pgEnum("legal_case_type", [
  "querella",
  "denuncia",
  "demanda",
  "otro",
]);

export const legalCaseStatusEnum = pgEnum("legal_case_status", [
  "vigente",
  "concluida",
  "archivada",
  "no_inicio",
]);

export const legalCases = pgTable(
  "legal_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    parcelId: uuid("parcel_id").references(() => parcels.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    type: legalCaseTypeEnum("type").default("denuncia").notNull(),
    status: legalCaseStatusEnum("status").default("vigente").notNull(),
    personName: text("person_name"), // cliente/persona involucrada
    counterparty: text("counterparty"), // denunciante / querellante
    accused: text("accused"), // imputado(s) / personas denunciadas
    tribunal: text("tribunal"),
    rol: text("rol"), // RIT / RUC / rol de causa
    anteQuien: text("ante_quien"), // institución ante la que se denuncia
    abogado: text("abogado"),
    contactoAbogado: text("contacto_abogado"),
    perjuicioClp: numeric("perjuicio_clp", { precision: 14, scale: 2 }),
    fechaInicio: timestamp("fecha_inicio", { withTimezone: true }),
    observacion: text("observacion"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("legal_cases_tenant_idx").on(t.tenantId),
    index("legal_cases_project_idx").on(t.projectId),
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
export type SellerCompany = typeof sellerCompanies.$inferSelect;
export type ParcelDocument = typeof parcelDocuments.$inferSelect;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type PromesaTemplate = typeof promesaTemplates.$inferSelect;
export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type Installment = typeof installments.$inferSelect;
export type LegalCase = typeof legalCases.$inferSelect;
export type BankMovement = typeof bankMovements.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type Acquisition = NonNullable<Project["acquisition"]>;

/** Tablas de negocio sujetas a Row-Level Security por tenant. */
export const TENANT_SCOPED_TABLES = [
  "blobs",
  "clients",
  "seller_companies",
  "projects",
  "parcels",
  "parcel_events",
  "money_vouchers",
  "invoices",
  "costs",
  "parcel_documents",
  "project_documents",
  "promesa_templates",
  "payment_plans",
  "installments",
  "legal_cases",
  "leads",
  "lead_activities",
  "bank_movements",
] as const;

export { sql };
