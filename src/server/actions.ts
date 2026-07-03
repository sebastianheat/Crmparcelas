"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hash } from "bcryptjs";
import { and, desc, eq, max } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import { withTenant, type TenantDb } from "@/db/tenant";
type TenantDbForActions = TenantDb;
import {
  bankMovements,
  clientDocuments,
  clients,
  costs,
  ghlSnapshots,
  installments,
  integrations,
  invoices,
  leadActivities,
  leads,
  legalCases,
  memberships,
  moneyVouchers,
  parcelDocuments,
  parcelEvents,
  parcels,
  paymentIntents,
  paymentPlans,
  projectDocuments,
  projectUpdates,
  projects,
  promesaTemplates,
  sellerCompanies,
  users,
  type ParcelEventType,
  type Role,
} from "@/db/schema";
import { generateLandingCopy } from "@/lib/ai/claude";
import { extractAcquisition } from "@/lib/ai/extract";
import { DEFAULT_PROMESA_MATRIZ } from "@/lib/promesa-template";
import { getDteProvider } from "@/lib/dte";
import { renderDocumentDocx } from "@/lib/docx";
import { getSignatureProvider } from "@/lib/signature";
import { EVENT_TO_STATUS, LEAD_STAGE } from "@/lib/labels";
import { parseCsv } from "@/lib/csv";
import { generateReservaPdf, renderDocumentPdf } from "@/lib/pdf";
import { generatePromesaText } from "@/lib/promesa";
import { storeFile } from "@/lib/storage";
import { syncBankForTenant } from "@/lib/bank/sync";
import { payInstallment } from "@/lib/cobranza";
import { handleInboundWhatsApp } from "@/lib/whatsapp/agent";
import { runRemindersForTenant } from "@/lib/reminders";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import { withCurrentTenant, requirePermission, requireSession, ACTIVE_TENANT_COOKIE } from "@/lib/session";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function num(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? String(n) : null;
}

// ─── Proyectos ────────────────────────────────────────────────────────────────

const projectSchema = z.object({
  name: z.string().min(2, "Nombre muy corto"),
  subBrand: z.string().optional(),
  comuna: z.string().optional(),
  provincia: z.string().optional(),
  region: z.string().optional(),
  priceUnit: z.enum(["clp", "uf"]).default("clp"),
  status: z
    .enum([
      "proximo_lanzamiento",
      "en_verde",
      "etapa",
      "entrega_inmediata",
      "escriturable",
      "nuevo",
      "vendido_100",
    ])
    .default("proximo_lanzamiento"),
  accessType: z.enum(["asfaltado", "estabilizado", "tierra"]).optional(),
  description: z.string().optional(),
});

export async function createProject(formData: FormData) {
  await requirePermission("projects:write");

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    subBrand: formData.get("subBrand") || undefined,
    comuna: formData.get("comuna") || undefined,
    provincia: formData.get("provincia") || undefined,
    region: formData.get("region") || undefined,
    priceUnit: formData.get("priceUnit") || "clp",
    status: formData.get("status") || "proximo_lanzamiento",
    accessType: formData.get("accessType") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const data = parsed.data;

  const factibilidad = {
    luz: formData.get("luz") === "on",
    aguaPotable: formData.get("aguaPotable") === "on",
    aguaRegadio: formData.get("aguaRegadio") === "on",
    iluminacionCaminos: formData.get("iluminacionCaminos") === "on",
    portonAutomatico: formData.get("portonAutomatico") === "on",
  };

  const slug = await withCurrentTenant(async (tx, { tenantId }) => {
    const base = slugify(data.name);
    let candidate = base;
    let n = 1;
    while (
      await tx.query.projects.findFirst({ where: eq(projects.slug, candidate) })
    ) {
      candidate = `${base}-${++n}`;
    }
    await tx.insert(projects).values({
      tenantId,
      name: data.name,
      subBrand: data.subBrand,
      slug: candidate,
      comuna: data.comuna,
      provincia: data.provincia,
      region: data.region,
      priceFrom: num(formData.get("priceFrom")),
      priceUnit: data.priceUnit,
      status: data.status,
      accessType: data.accessType,
      description: data.description,
      factibilidad,
    });
    return candidate;
  });

  revalidatePath("/app/proyectos");
  redirect(`/app/proyectos/${slug}`);
}

export async function generateLanding(formData: FormData) {
  await requirePermission("content:generate");
  const projectId = String(formData.get("projectId"));

  await withCurrentTenant(async (tx) => {
    const project = await tx.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) throw new Error("Proyecto no encontrado");
    const copy = await generateLandingCopy(project);
    await tx
      .update(projects)
      .set({ landingCopy: copy, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  });

  revalidatePath(`/app/proyectos`);
}

// ─── Parcelas ─────────────────────────────────────────────────────────────────

export async function addParcels(formData: FormData) {
  await requirePermission("parcels:write");
  const projectId = String(formData.get("projectId"));
  const prefix = String(formData.get("prefix") || "L").trim() || "L";
  const count = Math.min(
    Math.max(parseInt(String(formData.get("count") || "1"), 10) || 1, 1),
    200,
  );
  const areaM2 = num(formData.get("areaM2"));
  const price = num(formData.get("price"));
  const priceUnit = (formData.get("priceUnit") === "uf" ? "uf" : "clp") as
    | "uf"
    | "clp";

  await withCurrentTenant(async (tx, { tenantId }) => {
    const existing = await tx.query.parcels.findMany({
      where: eq(parcels.projectId, projectId),
      columns: { id: true },
    });
    const start = existing.length;
    await tx.insert(parcels).values(
      Array.from({ length: count }, (_, i) => ({
        tenantId,
        projectId,
        code: `${prefix}-${String(start + i + 1).padStart(2, "0")}`,
        areaM2,
        price,
        priceUnit,
        status: "disponible" as const,
      })),
    );
  });

  revalidatePath("/app/proyectos");
}

const moneyEventTypes: ParcelEventType[] = [
  "reserva",
  "promesa",
  "nueva_promesa",
  "escritura",
  "vale_vista",
];

/**
 * Aplica un evento al historial inmutable de la parcela. Si corresponde:
 *  - actualiza el estado (caché) de la parcela,
 *  - genera un comprobante de dinero (prefactura) cuando hay monto.
 */
export async function applyParcelEvent(formData: FormData) {
  await requirePermission("events:write");

  const parcelId = String(formData.get("parcelId"));
  const type = String(formData.get("type")) as ParcelEventType;
  const amountClp = num(formData.get("amountClp"));
  const clientId = String(formData.get("clientId") || "") || null;
  const sellerId = String(formData.get("sellerId") || "") || null;
  const repertorioCode = String(formData.get("repertorioCode") || "") || null;
  const note = String(formData.get("note") || "") || null;

  // Para movimientos con dinero, el vendedor responsable es obligatorio.
  if (amountClp && moneyEventTypes.includes(type) && !sellerId) {
    throw new Error("Selecciona el vendedor responsable de la reserva.");
  }

  // Datos que alimentan la promesa (forma de pago opcional, flexible).
  const clean = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));
  const payload = clean({
    formaPagoReserva: String(formData.get("formaPagoReserva") || "") || null,
    valorTotalParcela: num(formData.get("valorTotalParcela")),
    formaPago: (() => {
      const fp = clean({
        pieMonto: num(formData.get("pieMonto")),
        pieFecha: String(formData.get("pieFecha") || "") || null,
        nCuotas: String(formData.get("nCuotas") || "") || null,
        valorCuota: num(formData.get("valorCuota")),
        saldo: num(formData.get("saldo")),
        notas: String(formData.get("notasPago") || "") || null,
      });
      return Object.keys(fp).length ? fp : null;
    })(),
  });

  let projectSlug = "";
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const parcel = await tx.query.parcels.findFirst({
      where: eq(parcels.id, parcelId),
      with: { project: { columns: { slug: true } } },
    });
    if (!parcel) throw new Error("Parcela no encontrada");
    projectSlug = parcel.project.slug;

    const [event] = await tx
      .insert(parcelEvents)
      .values({
        tenantId,
        parcelId,
        projectId: parcel.projectId,
        type,
        clientId,
        amountClp,
        repertorioCode,
        note,
        sellerUserId: sellerId,
        payload,
        createdByUserId: userId,
      })
      .returning();

    // Actualizar estado (caché) de la parcela.
    const newStatus = EVENT_TO_STATUS[type];
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (newStatus) patch.status = newStatus;
    if (["reserva", "promesa", "nueva_promesa"].includes(type) && clientId) {
      patch.currentClientId = clientId;
    }
    if (["devolucion_reserva", "resciliacion"].includes(type)) {
      patch.currentClientId = null;
    }
    await tx.update(parcels).set(patch).where(eq(parcels.id, parcelId));

    // Generar comprobante de dinero (prefactura) si hay monto.
    if (amountClp && moneyEventTypes.includes(type)) {
      const [{ value: lastFolio }] = await tx
        .select({ value: max(moneyVouchers.folio) })
        .from(moneyVouchers);
      await tx.insert(moneyVouchers).values({
        tenantId,
        projectId: parcel.projectId,
        parcelId,
        clientId,
        parcelEventId: event.id,
        folio: (lastFolio ?? 0) + 1,
        concept: `${type} parcela ${parcel.code}`,
        amountClp,
        sellerUserId: sellerId,
        createdByUserId: userId,
      });
    }
  });

  revalidatePath(`/app/proyectos/${projectSlug}`);
  revalidatePath(`/app/parcelas/${parcelId}`);
  revalidatePath("/app/prefacturacion");
  revalidatePath("/app");
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export async function createClient(formData: FormData) {
  await requirePermission("events:write");
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) throw new Error("Nombre inválido");
  const str = (k: string) => String(formData.get(k) || "").trim() || null;
  await withCurrentTenant((tx, { tenantId }) =>
    tx.insert(clients).values({
      tenantId,
      name,
      rut: str("rut"),
      phone: str("phone"),
      phone2: str("phone2"),
      email: str("email"),
      direccion: str("direccion"),
      profesion: str("profesion"),
      estadoCivil: str("estadoCivil"),
      nacionalidad: str("nacionalidad") ?? "chilena",
    }),
  );
  revalidatePath("/app/clientes");
}

// ─── Costos ───────────────────────────────────────────────────────────────────

export async function createCost(formData: FormData) {
  await requirePermission("finance:write");
  const amountClp = num(formData.get("amountClp"));
  if (!amountClp) throw new Error("Monto inválido");
  const projectId = String(formData.get("projectId") || "") || null;
  await withCurrentTenant((tx, { tenantId, userId }) =>
    tx.insert(costs).values({
      tenantId,
      projectId,
      category: String(formData.get("category") || "otros") as never,
      amountClp,
      description: String(formData.get("description") || "") || null,
      createdByUserId: userId,
    }),
  );
  revalidatePath("/app/costos");
  revalidatePath("/app");
}

// ─── Facturación exenta (DTE) ─────────────────────────────────────────────────

export async function emitExentInvoice(formData: FormData) {
  await requirePermission("billing:write");
  const voucherId = String(formData.get("voucherId"));

  await withCurrentTenant(async (tx, { tenantId }) => {
    const voucher = await tx.query.moneyVouchers.findFirst({
      where: eq(moneyVouchers.id, voucherId),
    });
    if (!voucher) throw new Error("Comprobante no encontrado");
    if (voucher.status !== "validado") {
      throw new Error(
        "El comprobante debe estar validado por finanzas antes de facturar.",
      );
    }

    const provider = getDteProvider();
    const result = await provider.emitExentInvoice({
      exemptClp: Number(voucher.amountClp),
      concept: voucher.concept,
    });

    await tx.insert(invoices).values({
      tenantId,
      projectId: voucher.projectId,
      parcelId: voucher.parcelId,
      clientId: voucher.clientId,
      voucherId: voucher.id,
      folio: result.folio,
      exemptClp: voucher.amountClp,
      totalClp: voucher.amountClp,
      status: result.status === "aceptado" ? "emitida" : "borrador",
      dteProvider: result.provider,
      dteTrackId: result.trackId,
      dteStatus: result.status,
      issuedAt: new Date(),
    });

    await tx
      .update(moneyVouchers)
      .set({ status: "facturado" })
      .where(eq(moneyVouchers.id, voucherId));
  });

  revalidatePath("/app/prefacturacion");
}

// ─── Equipo: usuarios y roles ─────────────────────────────────────────────────

export async function createUser(formData: FormData) {
  const session = await requirePermission("users:manage");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "") as Role;

  if (!email || !name) throw new Error("Nombre y correo son obligatorios.");
  if (password.length < 6) throw new Error("La contraseña debe tener 6+ caracteres.");
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error("Rol inválido.");

  const passwordHash = await hash(password, 10);

  // users/memberships son globales (sin RLS).
  await db.transaction(async (tx) => {
    const existing = await tx.query.users.findFirst({
      where: eq(users.email, email),
    });
    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      const [u] = await tx
        .insert(users)
        .values({ email, name, passwordHash })
        .returning();
      userId = u.id;
    }
    await tx
      .insert(memberships)
      .values({ userId, tenantId: session.tenantId, role })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.tenantId],
        set: { role },
      });
  });

  revalidatePath("/app/equipo");
}

// ─── Validación de reserva (finanzas) con comprobante obligatorio + PDF ────────

export async function validateVoucher(formData: FormData) {
  const session = await requirePermission("reservas:validate");
  const voucherId = String(formData.get("voucherId"));
  const proof = formData.get("proof");

  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error(
      "Debes adjuntar la foto del comprobante de depósito/transferencia.",
    );
  }

  // 1) Guardar la foto del comprobante (Blob o Postgres).
  const proofBytes = new Uint8Array(await proof.arrayBuffer());
  const proofUrl = await storeFile({
    tenantId: session.tenantId,
    pathname: `comprobantes/proof-${voucherId}`,
    bytes: proofBytes,
    contentType: proof.type || "image/jpeg",
  });

  await withTenant(session.tenantId, async (tx) => {
    const sellerUser = alias(users, "seller_user");
    const [info] = await tx
      .select({
        voucher: moneyVouchers,
        projectName: projects.name,
        parcelCode: parcels.code,
        clientName: clients.name,
        sellerName: sellerUser.name,
      })
      .from(moneyVouchers)
      .leftJoin(projects, eq(moneyVouchers.projectId, projects.id))
      .leftJoin(parcels, eq(moneyVouchers.parcelId, parcels.id))
      .leftJoin(clients, eq(moneyVouchers.clientId, clients.id))
      .leftJoin(sellerUser, eq(moneyVouchers.sellerUserId, sellerUser.id))
      .where(eq(moneyVouchers.id, voucherId));

    if (!info) throw new Error("Comprobante no encontrado.");
    const validatedAt = new Date();

    // 2) Generar el PDF de la reserva con el comprobante embebido.
    const pdf = await generateReservaPdf(
      {
        tenantName: session.tenantName,
        folio: info.voucher.folio,
        concept: info.voucher.concept,
        amountClp: info.voucher.amountClp,
        projectName: info.projectName ?? "—",
        parcelCode: info.parcelCode ?? "—",
        clientName: info.clientName,
        sellerName: info.sellerName,
        validatedByName: session.user.name,
        validatedAt,
        proofUrl,
      },
      { bytes: proofBytes, type: proof.type || "image/jpeg" },
    );
    const pdfUrl = await storeFile({
      tenantId: session.tenantId,
      pathname: `comprobantes/reserva-${info.voucher.folio}.pdf`,
      bytes: pdf,
      contentType: "application/pdf",
    });

    // 3) Marcar validado.
    await tx
      .update(moneyVouchers)
      .set({
        status: "validado",
        proofUrl,
        pdfUrl,
        validatedByUserId: session.user.id,
        validatedAt,
      })
      .where(eq(moneyVouchers.id, voucherId));
  });

  revalidatePath("/app/prefacturacion");
}

// ─── Sociedades vendedoras ────────────────────────────────────────────────────

export async function createSellerCompany(formData: FormData) {
  await requirePermission("settings:write");
  const str = (k: string) => String(formData.get(k) || "").trim() || null;
  const razonSocial = str("razonSocial");
  if (!razonSocial) throw new Error("La razón social es obligatoria.");
  await withCurrentTenant((tx, { tenantId }) =>
    tx.insert(sellerCompanies).values({
      tenantId,
      razonSocial,
      rut: str("rut"),
      repNombre: str("repNombre"),
      repCI: str("repCI"),
      repNacionalidad: str("repNacionalidad") ?? "chilena",
      repEstadoCivil: str("repEstadoCivil"),
      repProfesion: str("repProfesion"),
      domicilio: str("domicilio"),
      personeriaNotaria: str("personeriaNotaria"),
      personeriaRepertorio: str("personeriaRepertorio"),
      personeriaFecha: str("personeriaFecha"),
    }),
  );
  revalidatePath("/app/sociedades");
}

// ─── Datos legales / de adquisición del proyecto ──────────────────────────────

export async function saveProjectLegal(formData: FormData) {
  await requirePermission("projects:write");
  const projectId = String(formData.get("projectId"));
  const str = (k: string) => String(formData.get(k) || "").trim() || undefined;
  const sellerCompanyId = String(formData.get("sellerCompanyId") || "") || null;

  const acquisition = {
    predioDenominacion: str("predioDenominacion"),
    subdelegacion: str("subdelegacion"),
    planoArchivoN: str("planoArchivoN"),
    planoCbr: str("planoCbr"),
    planoAnio: str("planoAnio"),
    superficie: str("superficie"),
    deslindes: {
      norte: str("deslindeNorte"),
      sur: str("deslindeSur"),
      oriente: str("deslindeOriente"),
      poniente: str("deslindePoniente"),
    },
    dominioFojas: str("dominioFojas"),
    dominioNumero: str("dominioNumero"),
    dominioAnio: str("dominioAnio"),
    dominioCbr: str("dominioCbr"),
    rolSii: str("rolSii"),
    subdivisionNLotes: str("subdivisionNLotes"),
    sagCertN: str("sagCertN"),
    sagFecha: str("sagFecha"),
    archivoCertSag: str("archivoCertSag"),
    archivoRoles: str("archivoRoles"),
    archivoPlano: str("archivoPlano"),
    aguas: str("aguas"),
  };

  let slug = "";
  await withCurrentTenant(async (tx) => {
    const legalStatus = (str("legalStatus") ?? "sin_definir") as
      | "sin_definir"
      | "sag_ingresado"
      | "sag_certificado"
      | "en_inscripcion"
      | "inscrito";
    const riesgo = (str("riesgo") ?? "bajo") as "bajo" | "medio" | "alto";
    const [p] = await tx
      .update(projects)
      .set({
        sellerCompanyId,
        notaria: str("notaria") ?? null,
        acquisition,
        legalStatus,
        riesgo,
        propio: formData.get("propio") !== "ajeno",
        denuncias: parseInt(String(formData.get("denuncias") || "0"), 10) || 0,
        legalNotes: str("legalNotes") ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning({ slug: projects.slug });
    slug = p?.slug ?? "";
  });
  if (slug) revalidatePath(`/app/proyectos/${slug}`);
}

// ─── Generación de la promesa de compraventa (M2) ─────────────────────────────

export async function generatePromesa(formData: FormData) {
  await requirePermission("events:write");
  const parcelId = String(formData.get("parcelId"));

  let projectSlug = "";
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const parcel = await tx.query.parcels.findFirst({
      where: eq(parcels.id, parcelId),
      with: { project: true, currentClient: true },
    });
    if (!parcel) throw new Error("Parcela no encontrada.");
    if (!parcel.currentClient) {
      throw new Error(
        "La parcela no tiene cliente asignado. Registra una reserva con cliente primero.",
      );
    }
    projectSlug = parcel.project.slug;

    const company = parcel.project.sellerCompanyId
      ? await tx.query.sellerCompanies.findFirst({
          where: eq(sellerCompanies.id, parcel.project.sellerCompanyId),
        })
      : null;

    // Forma de pago: del último evento con dinero (reserva/promesa).
    const lastMoney = await tx.query.parcelEvents.findFirst({
      where: eq(parcelEvents.parcelId, parcelId),
      orderBy: desc(parcelEvents.createdAt),
    });

    // Matriz del tenant (la edita el área legal); si no hay, IA libre.
    const tpl = await tx.query.promesaTemplates.findFirst({
      where: eq(promesaTemplates.isDefault, true),
    });

    const text = await generatePromesaText(
      {
        project: parcel.project,
        company: company ?? null,
        parcel,
        client: parcel.currentClient,
        notaria: parcel.project.notaria,
        pago: (lastMoney?.payload as Record<string, unknown>) ?? null,
      },
      tpl?.content ?? null,
    );

    const pdf = await renderDocumentPdf(
      `Promesa de compraventa — Parcela ${parcel.code}`,
      text,
    );
    const url = await storeFile({
      tenantId,
      pathname: `promesas/promesa-${parcel.project.slug}-${parcel.code}.pdf`,
      bytes: pdf,
      contentType: "application/pdf",
    });

    // Export Word (.docx) editable.
    const docx = await renderDocumentDocx(
      `Promesa de compraventa — Parcela ${parcel.code}`,
      text,
    );
    const docxUrl = await storeFile({
      tenantId,
      pathname: `promesas/promesa-${parcel.project.slug}-${parcel.code}.docx`,
      bytes: docx,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await tx.insert(parcelDocuments).values({
      tenantId,
      parcelId,
      projectId: parcel.projectId,
      type: "promesa",
      title: `Promesa de compraventa — ${parcel.currentClient.name}`,
      url,
      docxUrl,
      status: "borrador",
      generatedByAi: Boolean(process.env.ANTHROPIC_API_KEY),
      createdByUserId: userId,
    });
  });

  revalidatePath(`/app/parcelas/${parcelId}`);
  if (projectSlug) revalidatePath(`/app/proyectos/${projectSlug}`);
}

// ─── Documentos de adquisición + extracción con IA (M1) ───────────────────────

type ProjectDocType = (typeof projectDocuments.$inferInsert)["type"];

export async function uploadProjectDocument(formData: FormData) {
  await requirePermission("projects:write");
  const projectId = String(formData.get("projectId"));
  const type = (String(formData.get("docType") || "otro") as ProjectDocType);
  const file = formData.get("file");
  const doExtract = formData.get("extract") === "on";
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Adjunta un archivo.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const clean = (o: Record<string, unknown> | undefined | null) =>
    Object.fromEntries(
      Object.entries(o ?? {}).filter(([, v]) => v != null && v !== ""),
    );

  let projectSlug = "";
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const project = await tx.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) throw new Error("Proyecto no encontrado.");
    projectSlug = project.slug;

    const url = await storeFile({
      tenantId,
      pathname: `proyectos/${project.slug}/${file.name}`,
      bytes,
      contentType: file.type || "application/octet-stream",
    });

    let extracted = false;
    if (doExtract) {
      const result = await extractAcquisition(bytes, file.type || "");
      const cur = project.acquisition ?? {};
      const ex = result.acquisition ?? {};
      const merged = {
        ...cur,
        ...clean(ex as Record<string, unknown>),
        deslindes: {
          ...(cur.deslindes ?? {}),
          ...clean(ex.deslindes as Record<string, unknown>),
        },
      };
      await tx
        .update(projects)
        .set({
          acquisition: merged,
          notaria: result.notaria || project.notaria,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));
      extracted = true;
    }

    await tx.insert(projectDocuments).values({
      tenantId,
      projectId,
      type,
      title: file.name,
      url,
      mime: file.type || null,
      extracted,
      createdByUserId: userId,
    });
  });

  revalidatePath(`/app/proyectos/${projectSlug}`);
}

// ─── Matrices de promesa (área legal) ─────────────────────────────────────────

export async function loadDefaultPromesaTemplate() {
  await requirePermission("settings:write");
  await withCurrentTenant(async (tx, { tenantId }) => {
    const existing = await tx.query.promesaTemplates.findFirst({
      where: eq(promesaTemplates.isDefault, true),
    });
    if (existing) return;
    await tx.insert(promesaTemplates).values({
      tenantId,
      name: "Matriz por defecto",
      content: DEFAULT_PROMESA_MATRIZ,
      isDefault: true,
    });
  });
  revalidatePath("/app/matrices");
}

export async function savePromesaTemplate(formData: FormData) {
  await requirePermission("settings:write");
  const id = String(formData.get("id") || "") || null;
  const name = String(formData.get("name") || "").trim() || "Matriz";
  const content = String(formData.get("content") || "").trim();
  if (content.length < 50) throw new Error("La matriz está vacía o muy corta.");

  await withCurrentTenant(async (tx, { tenantId }) => {
    if (id) {
      await tx
        .update(promesaTemplates)
        .set({ name, content, updatedAt: new Date() })
        .where(eq(promesaTemplates.id, id));
    } else {
      const existing = await tx.query.promesaTemplates.findFirst({
        where: eq(promesaTemplates.isDefault, true),
      });
      await tx.insert(promesaTemplates).values({
        tenantId,
        name,
        content,
        isDefault: !existing,
      });
    }
  });
  revalidatePath("/app/matrices");
}

// ─── Firma electrónica (M2) ───────────────────────────────────────────────────

export async function sendToSignature(formData: FormData) {
  await requirePermission("events:write");
  const documentId = String(formData.get("documentId"));
  let parcelId = "";
  await withCurrentTenant(async (tx) => {
    const doc = await tx.query.parcelDocuments.findFirst({
      where: eq(parcelDocuments.id, documentId),
    });
    if (!doc) throw new Error("Documento no encontrado.");
    parcelId = doc.parcelId;
    const provider = getSignatureProvider();
    const res = await provider.send({
      documentUrl: doc.url,
      title: doc.title,
      signers: [],
    });
    await tx
      .update(parcelDocuments)
      .set({
        signatureProvider: res.provider,
        signatureRef: res.ref,
        signatureStatus: res.status,
        status: "en_firma",
      })
      .where(eq(parcelDocuments.id, documentId));
  });
  if (parcelId) revalidatePath(`/app/parcelas/${parcelId}`);
}

export async function markDocumentSigned(formData: FormData) {
  await requirePermission("events:write");
  const documentId = String(formData.get("documentId"));
  let parcelId = "";
  await withCurrentTenant(async (tx) => {
    const [doc] = await tx
      .update(parcelDocuments)
      .set({ signatureStatus: "firmado", status: "firmado", signedAt: new Date() })
      .where(eq(parcelDocuments.id, documentId))
      .returning({ parcelId: parcelDocuments.parcelId });
    parcelId = doc?.parcelId ?? "";
  });
  if (parcelId) revalidatePath(`/app/parcelas/${parcelId}`);
}

// ─── Cobranza / plan de pagos (crédito directo) ───────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function createPaymentPlan(formData: FormData) {
  await requirePermission("events:write");
  const parcelId = String(formData.get("parcelId"));
  const total = num(formData.get("totalClp"));
  const pie = num(formData.get("pieClp")) ?? "0";
  const nCuotas = Math.min(
    Math.max(parseInt(String(formData.get("nCuotas") || "1"), 10) || 1, 1),
    240,
  );
  const firstDueRaw = String(formData.get("firstDueDate") || "");
  if (!total) throw new Error("Indica el precio total.");
  const firstDue = firstDueRaw ? new Date(firstDueRaw) : addMonths(new Date(), 1);
  const saldo = Number(total) - Number(pie);
  const cuota = Math.round(saldo / nCuotas);

  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const parcel = await tx.query.parcels.findFirst({
      where: eq(parcels.id, parcelId),
    });
    if (!parcel) throw new Error("Parcela no encontrada.");

    const [plan] = await tx
      .insert(paymentPlans)
      .values({
        tenantId,
        parcelId,
        projectId: parcel.projectId,
        clientId: parcel.currentClientId,
        totalClp: total,
        pieClp: pie,
        nCuotas,
        createdByUserId: userId,
      })
      .returning();

    const rows = Array.from({ length: nCuotas }, (_, i) => ({
      tenantId,
      planId: plan.id,
      parcelId,
      number: i + 1,
      dueDate: addMonths(firstDue, i),
      // Ajustar última cuota por redondeo.
      amountClp:
        i === nCuotas - 1 ? String(saldo - cuota * (nCuotas - 1)) : String(cuota),
      status: "pendiente" as const,
    }));
    await tx.insert(installments).values(rows);
  });

  revalidatePath(`/app/parcelas/${parcelId}`);
}

export async function markInstallmentPaid(formData: FormData) {
  await requirePermission("billing:write");
  const installmentId = String(formData.get("installmentId"));
  let parcelId = "";
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const inst = await tx.query.installments.findFirst({
      where: eq(installments.id, installmentId),
      columns: { parcelId: true },
    });
    parcelId = inst?.parcelId ?? "";
    await payInstallment(tx, tenantId, installmentId, { userId });
  });
  if (parcelId) revalidatePath(`/app/parcelas/${parcelId}`);
  revalidatePath("/app/cobranza");
}

// ─── Cobros con Fintoc (payment intents) ──────────────────────────────────────

export async function createCuotaPaymentLink(formData: FormData) {
  await requirePermission("billing:write");
  const installmentId = String(formData.get("installmentId"));
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const inst = await tx.query.installments.findFirst({
      where: eq(installments.id, installmentId),
    });
    if (!inst) throw new Error("Cuota no encontrada.");
    const { fintoc } = await import("@/lib/fintoc");
    const pi = await fintoc.createPaymentIntent({
      amountClp: Number(inst.amountClp),
      metadata: { tenantId, installmentId, parcelId: inst.parcelId },
    });
    await tx.insert(paymentIntents).values({
      tenantId,
      provider: "fintoc",
      externalId: pi.id,
      installmentId,
      parcelId: inst.parcelId,
      amountClp: inst.amountClp,
      status: pi.status || "pending",
      widgetToken: pi.widget_token ?? null,
      createdByUserId: userId,
    });
  });
  revalidatePath("/app/cobranza");
}

export async function refreshFintoc() {
  await requirePermission("finance:write");
  const { fintoc } = await import("@/lib/fintoc");
  await fintoc.refreshIntent();
  revalidatePath("/app/conciliacion");
}

// ─── Causas legales (querellas / denuncias) ───────────────────────────────────

export async function createLegalCase(formData: FormData) {
  await requirePermission("settings:write");
  const projectId = String(formData.get("projectId") || "") || null;
  const fechaRaw = String(formData.get("fechaInicio") || "");
  const str = (k: string) => {
    const v = String(formData.get(k) || "").trim();
    return v || null;
  };
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    await tx.insert(legalCases).values({
      tenantId,
      projectId,
      type: (str("type") ?? "denuncia") as
        | "querella"
        | "denuncia"
        | "demanda"
        | "otro",
      status: (str("status") ?? "vigente") as
        | "vigente"
        | "concluida"
        | "archivada"
        | "no_inicio",
      personName: str("personName"),
      counterparty: str("counterparty"),
      accused: str("accused"),
      tribunal: str("tribunal"),
      rol: str("rol"),
      anteQuien: str("anteQuien"),
      abogado: str("abogado"),
      contactoAbogado: str("contactoAbogado"),
      perjuicioClp: num(formData.get("perjuicioClp")),
      fechaInicio: fechaRaw ? new Date(fechaRaw) : null,
      observacion: str("observacion"),
      createdByUserId: userId,
    });
  });
  revalidatePath("/app/legal");
}

export async function updateLegalCaseStatus(formData: FormData) {
  await requirePermission("settings:write");
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as
    | "vigente"
    | "concluida"
    | "archivada"
    | "no_inicio";
  await withCurrentTenant(async (tx) => {
    await tx
      .update(legalCases)
      .set({ status, updatedAt: new Date() })
      .where(eq(legalCases.id, id));
  });
  revalidatePath("/app/legal");
}

// ─── Comisiones de vendedores (M8) ────────────────────────────────────────────

export async function setCommissionPct(formData: FormData) {
  await requirePermission("finance:write");
  const userId = String(formData.get("userId"));
  const pct = num(formData.get("commissionPct")); // puede ser null (sin comisión)
  await withCurrentTenant(async (tx) => {
    await tx
      .update(memberships)
      .set({ commissionPct: pct })
      .where(eq(memberships.userId, userId));
  });
  revalidatePath("/app/comisiones");
}

// ─── CRM — Leads y embudo de ventas (Fase 2) ──────────────────────────────────

export async function createLead(formData: FormData) {
  await requirePermission("reservas:create");
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) throw new Error("Indica el nombre del lead.");
  const str = (k: string) => String(formData.get(k) || "").trim() || null;
  const assignedTo = str("assignedToUserId");
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    await tx.insert(leads).values({
      tenantId,
      name,
      phone: str("phone"),
      email: str("email"),
      source: (str("source") ?? "web") as
        | "web"
        | "whatsapp"
        | "instagram"
        | "facebook"
        | "portal"
        | "referido"
        | "otro",
      projectId: str("projectId"),
      assignedToUserId: assignedTo,
      estimatedValueClp: num(formData.get("estimatedValueClp")),
      notes: str("notes"),
      createdByUserId: userId,
    });
  });
  revalidatePath("/app/crm");
}

export async function updateLeadStage(formData: FormData) {
  await requirePermission("reservas:create");
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage"));
  const lostReason = String(formData.get("lostReason") || "").trim() || null;
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    await tx
      .update(leads)
      .set({
        stage,
        lostReason: stage === "perdido" ? lostReason : null,
        lastContactAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
    await tx.insert(leadActivities).values({
      tenantId,
      leadId: id,
      type: "cambio_etapa",
      note: `Etapa → ${stage}${lostReason ? ` (${lostReason})` : ""}`,
      createdByUserId: userId,
    });
  });
  revalidatePath("/app/crm");
  revalidatePath(`/app/crm/${id}`);
}

export async function assignLead(formData: FormData) {
  await requirePermission("reservas:create");
  const id = String(formData.get("id"));
  const assignedToUserId = String(formData.get("assignedToUserId") || "") || null;
  await withCurrentTenant(async (tx) => {
    await tx
      .update(leads)
      .set({ assignedToUserId, updatedAt: new Date() })
      .where(eq(leads.id, id));
  });
  revalidatePath("/app/crm");
  revalidatePath(`/app/crm/${id}`);
}

export async function addLeadActivity(formData: FormData) {
  await requirePermission("reservas:create");
  const leadId = String(formData.get("leadId"));
  const type = String(formData.get("type") || "nota") as
    | "nota"
    | "llamada"
    | "whatsapp"
    | "email"
    | "visita"
    | "cambio_etapa";
  const note = String(formData.get("note") || "").trim() || null;
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    await tx.insert(leadActivities).values({
      tenantId,
      leadId,
      type,
      note,
      createdByUserId: userId,
    });
    await tx
      .update(leads)
      .set({ lastContactAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, leadId));
  });
  revalidatePath(`/app/crm/${leadId}`);
}

export async function convertLeadToClient(formData: FormData) {
  await requirePermission("reservas:create");
  const id = String(formData.get("id"));
  let clientId = "";
  await withCurrentTenant(async (tx, { tenantId }) => {
    const lead = await tx.query.leads.findFirst({ where: eq(leads.id, id) });
    if (!lead) throw new Error("Lead no encontrado.");
    if (lead.clientId) {
      clientId = lead.clientId;
      return;
    }
    const [client] = await tx
      .insert(clients)
      .values({
        tenantId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
      })
      .returning({ id: clients.id });
    clientId = client.id;
    await tx
      .update(leads)
      .set({ clientId, stage: "ganado", updatedAt: new Date() })
      .where(eq(leads.id, id));
  });
  if (clientId) redirect(`/app/clientes`);
}

// ─── WhatsApp (agente IA) ─────────────────────────────────────────────────────

export async function simulateInboundWhatsApp(formData: FormData) {
  await requirePermission("reservas:create");
  const from = String(formData.get("from") || "").trim();
  const text = String(formData.get("text") || "").trim();
  if (!from || !text) throw new Error("Indica número y mensaje.");
  const tenantId = await withCurrentTenant(async (_tx, ctx) => ctx.tenantId);
  await handleInboundWhatsApp({ tenantId, from, text });
  revalidatePath("/app/whatsapp");
  revalidatePath("/app/crm");
}

// ─── Conciliación bancaria (Fintoc / open banking) ────────────────────────────

export async function syncBankMovements() {
  await requirePermission("finance:write");
  await withCurrentTenant((tx, { tenantId }) => syncBankForTenant(tx, tenantId));
  revalidatePath("/app/conciliacion");
}

export async function reconcileMovement(formData: FormData) {
  await requirePermission("finance:write");
  const id = String(formData.get("id"));
  const voucherId = String(formData.get("voucherId") || "") || null;
  await withCurrentTenant(async (tx, { userId }) => {
    await tx
      .update(bankMovements)
      .set({
        status: voucherId ? "conciliado" : "pendiente",
        matchedVoucherId: voucherId,
        reconciledByUserId: userId,
        reconciledAt: new Date(),
      })
      .where(eq(bankMovements.id, id));
  });
  revalidatePath("/app/conciliacion");
}

export async function ignoreMovement(formData: FormData) {
  await requirePermission("finance:write");
  const id = String(formData.get("id"));
  await withCurrentTenant(async (tx) => {
    await tx
      .update(bankMovements)
      .set({ status: "ignorado", matchedVoucherId: null })
      .where(eq(bankMovements.id, id));
  });
  revalidatePath("/app/conciliacion");
}

// ─── Carpeta digital del cliente (expediente) ─────────────────────────────────

type ClientDocType = (typeof clientDocuments.$inferInsert)["type"];

export async function uploadClientDocument(formData: FormData) {
  await requirePermission("events:write");
  const clientId = String(formData.get("clientId"));
  const type = String(formData.get("docType") || "otro") as ClientDocType;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Adjunta un archivo.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const client = await tx.query.clients.findFirst({
      where: eq(clients.id, clientId),
    });
    if (!client) throw new Error("Cliente no encontrado.");
    const url = await storeFile({
      tenantId,
      pathname: `clientes/${clientId}/${Date.now()}-${file.name}`,
      bytes,
      contentType: file.type || "application/octet-stream",
    });
    await tx.insert(clientDocuments).values({
      tenantId,
      clientId,
      type,
      title: file.name,
      url,
      mime: file.type || null,
      createdByUserId: userId,
    });
  });
  revalidatePath(`/app/clientes/${clientId}`);
}

export async function deleteClientDocument(formData: FormData) {
  await requirePermission("events:write");
  const id = String(formData.get("id"));
  const clientId = String(formData.get("clientId"));
  await withCurrentTenant(async (tx) => {
    await tx.delete(clientDocuments).where(eq(clientDocuments.id, id));
  });
  revalidatePath(`/app/clientes/${clientId}`);
}

/**
 * Carga masiva: sube VARIOS archivos de una vez a la carpeta digital de un
 * cliente. Cada archivo va a storeFile (Vercel Blob si BLOB_READ_WRITE_TOKEN
 * está configurado; si no, Postgres) y queda visible en el portal del cliente.
 */
export async function uploadClientDocumentsBulk(formData: FormData) {
  await requirePermission("events:write");
  const clientId = String(formData.get("clientId"));
  const type = String(formData.get("docType") || "otro") as ClientDocType;
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Adjunta al menos un archivo.");

  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const client = await tx.query.clients.findFirst({
      where: eq(clients.id, clientId),
      columns: { id: true },
    });
    if (!client) throw new Error("Cliente no encontrado.");
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = await storeFile({
        tenantId,
        pathname: `clientes/${clientId}/${file.name}`,
        bytes,
        contentType: file.type || "application/octet-stream",
      });
      await tx.insert(clientDocuments).values({
        tenantId,
        clientId,
        type,
        title: file.name,
        url,
        mime: file.type || null,
        createdByUserId: userId,
      });
    }
  });
  revalidatePath(`/app/clientes/${clientId}`);
  revalidatePath("/app/legal/cargar");
  revalidatePath("/portal");
}

// ─── Recordatorios automáticos ────────────────────────────────────────────────

export async function runRemindersNow() {
  await requirePermission("events:write");
  const tenantId = await withCurrentTenant(async (_tx, ctx) => ctx.tenantId);
  await runRemindersForTenant(tenantId);
  revalidatePath("/app/recordatorios");
  revalidatePath("/app/cobranza");
}

// ─── Captura de leads desde la web pública (sin sesión) ───────────────────────

export async function captureWebLead(formData: FormData) {
  // Honeypot anti-bots.
  if (String(formData.get("website") || "")) redirect("/");
  const tenantId = String(formData.get("tenantId") || "");
  const tenantSlug = String(formData.get("tenantSlug") || "");
  const projectSlug = String(formData.get("projectSlug") || "");
  const projectId = String(formData.get("projectId") || "") || null;
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const message = String(formData.get("message") || "").trim() || null;
  if (!tenantId || name.length < 2) redirect(`/p/${tenantSlug}/${projectSlug}?err=1`);

  await withTenant(tenantId, async (tx) => {
    const [lead] = await tx
      .insert(leads)
      .values({
        tenantId,
        name,
        phone,
        email,
        source: "web",
        stage: "entrada",
        projectId,
        notes: message,
      })
      .returning({ id: leads.id });
    if (message) {
      await tx.insert(leadActivities).values({
        tenantId,
        leadId: lead.id,
        type: "nota",
        note: `Consulta web: ${message}`,
      });
    }
  });
  redirect(`/p/${tenantSlug}/${projectSlug}?ok=1`);
}

// ─── Importación de leads desde CSV (export de GHL/Toscana u otro) ─────────────

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function buildStageMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [key, v] of Object.entries(LEAD_STAGE)) m[norm(v.label)] = key;
  // Alias frecuentes de GHL/Toscana.
  Object.assign(m, {
    reservas: "reservas",
    reserva: "reservas",
    nuevo: "entrada",
    entrada: "entrada",
    ganado: "promesando",
    promesando: "promesando",
    "no interesado": "perdido",
    descartado: "perdido",
    perdido: "perdido",
    lost: "perdido",
  });
  return m;
}

function mapSource(raw: string): string {
  const s = norm(raw);
  if (s.includes("whats")) return "whatsapp";
  if (s.includes("insta")) return "instagram";
  if (s.includes("face")) return "facebook";
  if (s.includes("portal")) return "portal";
  if (s.includes("refer")) return "referido";
  if (s.includes("web") || s.includes("form") || s.includes("landing")) return "web";
  return "otro";
}

/** Busca el índice de la primera columna cuyo encabezado contenga algún alias. */
function findCol(headers: string[], aliases: string[]): number {
  const H = headers.map(norm);
  for (let i = 0; i < H.length; i++) {
    if (aliases.some((a) => H[i] === a || H[i].includes(a))) return i;
  }
  return -1;
}

export async function importLeadsCsv(formData: FormData) {
  await requirePermission("reservas:create");
  const file = formData.get("file");
  let text = String(formData.get("csvText") || "");
  if (file instanceof File && file.size > 0) {
    text = new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
  }
  if (text.trim().length < 5) redirect("/app/importar?err=1");

  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) redirect("/app/importar?err=1");

  const iName = findCol(headers, ["name", "nombre", "contact name", "full name"]);
  const iFirst = findCol(headers, ["first name", "nombres"]);
  const iLast = findCol(headers, ["last name", "apellido", "apellidos"]);
  const iPhone = findCol(headers, ["phone", "telefono", "celular", "mobile", "movil"]);
  const iEmail = findCol(headers, ["email", "correo", "e-mail"]);
  const iStage = findCol(headers, ["stage", "etapa", "pipeline stage", "estado"]);
  const iSource = findCol(headers, ["source", "origen", "contact source"]);
  const iValue = findCol(headers, ["value", "valor", "monto", "lead value", "opportunity value"]);

  const stageMap = buildStageMap();
  const cap = rows.slice(0, 3000);

  let imported = 0;
  let skipped = 0;
  await withCurrentTenant(async (tx, { tenantId }) => {
    const existing = await tx
      .select({ phone: leads.phone, email: leads.email })
      .from(leads);
    const phones = new Set(existing.map((e) => e.phone).filter(Boolean));
    const emails = new Set(
      existing.map((e) => (e.email ? e.email.toLowerCase() : null)).filter(Boolean),
    );

    for (const r of cap) {
      const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
      const name =
        get(iName) ||
        [get(iFirst), get(iLast)].filter(Boolean).join(" ").trim();
      if (!name || name.length < 2) { skipped++; continue; }
      const phone = get(iPhone) || null;
      const email = get(iEmail) || null;
      if (phone && phones.has(phone)) { skipped++; continue; }
      if (email && emails.has(email.toLowerCase())) { skipped++; continue; }

      const stage = stageMap[norm(get(iStage))] ?? "entrada";
      const source = iSource >= 0 ? mapSource(get(iSource)) : "otro";
      const value = num(get(iValue));

      await tx.insert(leads).values({
        tenantId,
        name,
        phone,
        email,
        source: source as "web" | "whatsapp" | "instagram" | "facebook" | "portal" | "referido" | "otro",
        stage,
        estimatedValueClp: value,
        notes: "Importado desde CSV",
      });
      if (phone) phones.add(phone);
      if (email) emails.add(email.toLowerCase());
      imported++;
    }
  });
  redirect(`/app/importar?ok=${imported}&skip=${skipped}`);
}

// ─── Integración GHL / LeadConnector (sincronización vía API) ──────────────────

export async function saveGhlConfig(formData: FormData) {
  await requirePermission("settings:write");
  const token = String(formData.get("token") || "").trim();
  const locationId = String(formData.get("locationId") || "").trim();
  if (!token || !locationId) redirect("/app/integraciones?err=cfg");
  await withCurrentTenant(async (tx, { tenantId }) => {
    await tx
      .insert(integrations)
      .values({ tenantId, provider: "ghl", config: { token, locationId } })
      .onConflictDoUpdate({
        target: [integrations.tenantId, integrations.provider],
        set: { config: { token, locationId }, updatedAt: new Date() },
      });
  });
  redirect("/app/integraciones?saved=1");
}

async function getGhlClient(tx: TenantDbForActions) {
  const cfg = await tx.query.integrations.findFirst({
    where: eq(integrations.provider, "ghl"),
  });
  const token = cfg?.config?.token;
  const locationId = cfg?.config?.locationId;
  if (!token || !locationId) return null;
  const { GhlClient } = await import("@/lib/ghl");
  return new GhlClient(token, locationId);
}

export async function testGhlConnection() {
  await requirePermission("settings:write");
  let result = "err";
  let n = 0;
  await withCurrentTenant(async (tx) => {
    const client = await getGhlClient(tx);
    if (!client) return;
    try {
      const p = await client.pipelines();
      n = p.length;
      result = "ok";
    } catch (e) {
      console.error("[ghl] test", e);
    }
  });
  redirect(`/app/integraciones?test=${result}&pipelines=${n}`);
}

export async function syncGhlLeads() {
  await requirePermission("reservas:create");
  let synced = 0;
  let updated = 0;
  let result = "ok";
  await withCurrentTenant(async (tx, { tenantId }) => {
    const client = await getGhlClient(tx);
    if (!client) {
      result = "nocfg";
      return;
    }
    try {
      const pipelines = await client.pipelines();
      const stageName = new Map<string, string>();
      for (const p of pipelines)
        for (const s of p.stages) stageName.set(s.id, s.name);

      const opps = await client.allOpportunities();
      const stageMap = buildStageMap();

      const existing = await tx
        .select({ id: leads.id, externalId: leads.externalId })
        .from(leads);
      const byExt = new Map(
        existing.filter((e) => e.externalId).map((e) => [e.externalId!, e.id]),
      );

      for (const o of opps) {
        const c = o.contact ?? {};
        const externalId = c.id ?? o.id;
        const name = (c.name || o.name || "Sin nombre").trim();
        const phone = c.phone || null;
        const email = c.email || null;
        const stage =
          stageMap[norm(stageName.get(o.pipelineStageId ?? "") ?? "")] ?? "entrada";
        const source = o.source ? mapSource(o.source) : "otro";
        const value = o.monetaryValue ? String(Math.round(o.monetaryValue)) : null;

        const found = byExt.get(externalId);
        if (found) {
          await tx
            .update(leads)
            .set({ stage, estimatedValueClp: value, phone, email, updatedAt: new Date() })
            .where(eq(leads.id, found));
          updated++;
        } else {
          await tx.insert(leads).values({
            tenantId,
            name,
            phone,
            email,
            source: source as "web" | "whatsapp" | "instagram" | "facebook" | "portal" | "referido" | "otro",
            stage,
            estimatedValueClp: value,
            externalId,
            notes: "Sincronizado desde GHL",
          });
          byExt.set(externalId, "x");
          synced++;
        }
      }
      await tx
        .update(integrations)
        .set({ lastSyncAt: new Date() })
        .where(eq(integrations.provider, "ghl"));
    } catch (e) {
      console.error("[ghl] sync", e);
      result = "err";
    }
  });
  revalidatePath("/app/crm");
  redirect(`/app/integraciones?sync=${result}&new=${synced}&upd=${updated}`);
}

// ─── Clonado masivo desde GHL (one-time, por etapas, resumible) ───────────────

async function upsertSnapshot(
  tx: TenantDbForActions,
  tenantId: string,
  kind: string,
  externalId: string,
  payload: Record<string, unknown>,
  parentId?: string,
) {
  await tx
    .insert(ghlSnapshots)
    .values({ tenantId, kind, externalId, parentId: parentId ?? null, payload })
    .onConflictDoUpdate({
      target: [ghlSnapshots.tenantId, ghlSnapshots.kind, ghlSnapshots.externalId],
      set: { payload, fetchedAt: new Date() },
    });
}

export async function cloneGhl(formData: FormData) {
  await requirePermission("settings:write");
  const kind = String(formData.get("kind") || "core");
  let summary = "";
  await withCurrentTenant(async (tx, { tenantId }) => {
    const client = await getGhlClient(tx);
    if (!client) { summary = "nocfg"; return; }

    if (kind === "core") {
      // Contactos → snapshots + clientes (dedupe por email/teléfono).
      const contacts = await client.allContacts();
      const existingClients = await tx
        .select({ email: clients.email, phone: clients.phone })
        .from(clients);
      const emails = new Set(existingClients.map((c) => c.email?.toLowerCase()).filter(Boolean));
      const phones = new Set(existingClients.map((c) => c.phone).filter(Boolean));
      let newClients = 0;
      for (const c of contacts) {
        const id = String(c.id ?? "");
        if (!id) continue;
        await upsertSnapshot(tx, tenantId, "contacts", id, c);
        const email = (c.email as string) || null;
        const phone = (c.phone as string) || null;
        const name =
          (c.contactName as string) ||
          [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
          (c.name as string) || "";
        if (name.length < 2) continue;
        if (email && emails.has(email.toLowerCase())) continue;
        if (phone && phones.has(phone)) continue;
        await tx.insert(clients).values({
          tenantId,
          name,
          email,
          phone,
          direccion: (c.address1 as string) || null,
        });
        if (email) emails.add(email.toLowerCase());
        if (phone) phones.add(phone);
        newClients++;
      }

      // Pipelines + oportunidades → snapshots + leads (idempotente por externalId).
      const pipelines = await client.pipelines();
      const stageName = new Map<string, string>();
      for (const p of pipelines) {
        await upsertSnapshot(tx, tenantId, "pipelines", p.id, p as unknown as Record<string, unknown>);
        for (const s of p.stages) stageName.set(s.id, s.name);
      }
      const opps = await client.allOpportunities();
      const stageMap = buildStageMap();
      const existingLeads = await tx
        .select({ id: leads.id, externalId: leads.externalId })
        .from(leads);
      const byExt = new Map(existingLeads.filter((e) => e.externalId).map((e) => [e.externalId!, e.id]));
      let newLeads = 0;
      for (const o of opps) {
        await upsertSnapshot(tx, tenantId, "opportunities", o.id, o as unknown as Record<string, unknown>);
        const c = o.contact ?? {};
        const externalId = c.id ?? o.id;
        const stage = stageMap[norm(stageName.get(o.pipelineStageId ?? "") ?? "")] ?? "entrada";
        const value = o.monetaryValue ? String(Math.round(o.monetaryValue)) : null;
        const found = byExt.get(externalId);
        if (found) {
          await tx.update(leads).set({ stage, estimatedValueClp: value, updatedAt: new Date() }).where(eq(leads.id, found));
        } else {
          await tx.insert(leads).values({
            tenantId,
            name: (c.name || o.name || "Sin nombre").trim(),
            phone: c.phone || null,
            email: c.email || null,
            source: (o.source ? mapSource(o.source) : "otro") as "web" | "whatsapp" | "instagram" | "facebook" | "portal" | "referido" | "otro",
            stage,
            estimatedValueClp: value,
            externalId,
            notes: "Clonado desde GHL",
          });
          byExt.set(externalId, "x");
          newLeads++;
        }
      }
      summary = `core ${contacts.length} contactos (${newClients} clientes nuevos), ${opps.length} oportunidades (${newLeads} leads nuevos)`;
    } else if (kind === "conversations") {
      const convs = await client.allConversations();
      for (const c of convs) {
        const id = String(c.id ?? "");
        if (id) await upsertSnapshot(tx, tenantId, "conversations", id, c);
      }
      summary = `${convs.length} conversaciones`;
    } else if (kind === "messages") {
      // Procesa un lote de conversaciones que aún no tengan mensajes clonados.
      const convs = await tx.query.ghlSnapshots.findMany({
        where: eq(ghlSnapshots.kind, "conversations"),
        limit: 400,
      });
      const withMsgs = new Set(
        (
          await tx
            .select({ parentId: ghlSnapshots.parentId })
            .from(ghlSnapshots)
            .where(eq(ghlSnapshots.kind, "messages"))
        ).map((m) => m.parentId).filter(Boolean),
      );
      const pending = convs.filter((c) => !withMsgs.has(c.externalId)).slice(0, 40);
      let msgCount = 0;
      for (const conv of pending) {
        const msgs = await client.messages(conv.externalId);
        for (const m of msgs) {
          const mid = String(m.id ?? `${conv.externalId}-${msgCount}`);
          await upsertSnapshot(tx, tenantId, "messages", mid, m, conv.externalId);
          msgCount++;
        }
        // Marca la conversación como procesada aunque no tenga mensajes.
        if (msgs.length === 0)
          await upsertSnapshot(tx, tenantId, "messages", `empty-${conv.externalId}`, { empty: true }, conv.externalId);
      }
      summary = `${pending.length} conversaciones procesadas, ${msgCount} mensajes (quedan ${convs.length - withMsgs.size - pending.length})`;
    } else if (kind === "config") {
      for (const u of await client.users()) if (u.id) await upsertSnapshot(tx, tenantId, "users", String(u.id), u);
      for (const f of await client.customFields()) if (f.id) await upsertSnapshot(tx, tenantId, "custom_fields", String(f.id), f);
      for (const t of await client.tags()) if (t.id || t.name) await upsertSnapshot(tx, tenantId, "tags", String(t.id ?? t.name), t);
      for (const c of await client.calendars()) if (c.id) await upsertSnapshot(tx, tenantId, "calendars", String(c.id), c);
      summary = "config (usuarios, campos, tags, calendarios)";
    }

    await tx.update(integrations).set({ lastSyncAt: new Date() }).where(eq(integrations.provider, "ghl"));
  });
  revalidatePath("/app/integraciones");
  redirect(`/app/integraciones?clone=${encodeURIComponent(summary || "ok")}`);
}

// ─── Pago de cuota desde el Portal del Cliente (Fintoc widget) ────────────────

export async function createPortalCuotaPayment(
  installmentId: string,
): Promise<{ widgetToken?: string; error?: string }> {
  const { cookies } = await import("next/headers");
  const { verifyPortalToken } = await import("@/lib/portal");
  const token = (await cookies()).get("portal")?.value;
  const payload = verifyPortalToken(token);
  if (!payload) return { error: "Sesión del portal inválida." };

  try {
    return await withTenant(payload.tenantId, async (tx) => {
      const inst = await tx.query.installments.findFirst({
        where: eq(installments.id, installmentId),
      });
      if (!inst || inst.status === "pagada") return { error: "Cuota no disponible." };
      const parcel = await tx.query.parcels.findFirst({
        where: eq(parcels.id, inst.parcelId),
        columns: { currentClientId: true },
      });
      // El cliente del portal solo puede pagar sus propias cuotas.
      if (!parcel || parcel.currentClientId !== payload.clientId)
        return { error: "No autorizado." };

      const { fintoc } = await import("@/lib/fintoc");
      const pi = await fintoc.createPaymentIntent({
        amountClp: Number(inst.amountClp),
        metadata: { tenantId: payload.tenantId, installmentId, parcelId: inst.parcelId },
      });
      await tx.insert(paymentIntents).values({
        tenantId: payload.tenantId,
        provider: "fintoc",
        externalId: pi.id,
        installmentId,
        parcelId: inst.parcelId,
        amountClp: inst.amountClp,
        status: pi.status || "pending",
        widgetToken: pi.widget_token ?? null,
      });
      return { widgetToken: pi.widget_token };
    });
  } catch (e) {
    console.error("[portal] pago fintoc", e);
    return { error: "No se pudo iniciar el pago." };
  }
}

// ─── Multi-tenant: selector de empresa ────────────────────────────────────────

export async function switchTenant(formData: FormData) {
  const tenantId = String(formData.get("tenantId"));
  const session = await requireSession();
  const m = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, session.user.id),
      eq(memberships.tenantId, tenantId),
    ),
  });
  if (!m) throw new Error("No tienes acceso a esa empresa.");
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/app");
}

// ─── Comprobante de pago por cuota (ejecutivo de cobranza) ────────────────────

export async function uploadInstallmentProof(formData: FormData) {
  await requirePermission("billing:write");
  const installmentId = String(formData.get("installmentId"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Adjunta el comprobante.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let parcelId = "";
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const inst = await tx.query.installments.findFirst({
      where: eq(installments.id, installmentId),
      columns: { parcelId: true, number: true },
    });
    if (!inst) throw new Error("Cuota no encontrada.");
    parcelId = inst.parcelId;
    const url = await storeFile({
      tenantId,
      pathname: `cobranza/${installmentId}/${file.name}`,
      bytes,
      contentType: file.type || "application/octet-stream",
    });
    // Sube comprobante + marca la cuota pagada (genera comprobante de dinero).
    await payInstallment(tx, tenantId, installmentId, { userId });
    await tx
      .update(installments)
      .set({ proofUrl: url })
      .where(eq(installments.id, installmentId));
  });
  if (parcelId) revalidatePath(`/app/parcelas/${parcelId}`);
  revalidatePath("/app/cobranza");
}

// ─── Avances de proyecto (portal del cliente) ─────────────────────────────────

/**
 * Publica un avance/hito/aviso/plazo del proyecto. Sube fotos opcionales
 * (múltiples) a storeFile y las guarda en image_urls. Bitácora append-only:
 * el cliente lo ve en su portal.
 */
export async function addProjectUpdate(formData: FormData) {
  await requirePermission("projects:write");
  const projectId = String(formData.get("projectId"));
  const kind = String(formData.get("kind") || "avance") as
    | "avance"
    | "hito"
    | "notificacion"
    | "plazo";
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim() || null;
  const stage = String(formData.get("stage") || "").trim() || null;
  const dueDateRaw = String(formData.get("dueDate") || "").trim();
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  if (!title) throw new Error("Escribe un título del avance.");

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);

  let projectSlug = "";
  await withCurrentTenant(async (tx, { tenantId, userId }) => {
    const project = await tx.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { slug: true },
    });
    if (!project) throw new Error("Proyecto no encontrado.");
    projectSlug = project.slug;

    const imageUrls: string[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = await storeFile({
        tenantId,
        pathname: `avances/${projectId}/${file.name}`,
        bytes,
        contentType: file.type || "application/octet-stream",
      });
      imageUrls.push(url);
    }

    await tx.insert(projectUpdates).values({
      tenantId,
      projectId,
      kind,
      stage,
      title,
      body,
      imageUrls,
      dueDate,
      createdByUserId: userId,
    });
  });

  revalidatePath(`/app/proyectos/${projectSlug}`);
  revalidatePath("/portal");
}

/** Marca un plazo como cumplido (registra la fecha real de cumplimiento). */
export async function completeProjectUpdate(formData: FormData) {
  await requirePermission("projects:write");
  const id = String(formData.get("updateId"));
  let projectSlug = "";
  await withCurrentTenant(async (tx) => {
    const [row] = await tx
      .update(projectUpdates)
      .set({ doneAt: new Date() })
      .where(eq(projectUpdates.id, id))
      .returning({ projectId: projectUpdates.projectId });
    if (row) {
      const project = await tx.query.projects.findFirst({
        where: eq(projects.id, row.projectId),
        columns: { slug: true },
      });
      projectSlug = project?.slug ?? "";
    }
  });
  if (projectSlug) revalidatePath(`/app/proyectos/${projectSlug}`);
  revalidatePath("/portal");
}

/**
 * Cambia el precio de lista de una parcela. Solo super admin (dueño):
 * pensado para fijar/ajustar precios del stock disponible.
 */
export async function updateParcelPrice(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "super_admin") {
    throw new Error("Solo el super admin puede cambiar precios.");
  }
  const parcelId = String(formData.get("parcelId"));
  const raw = String(formData.get("price") || "").replace(/[.$\s]/g, "");
  const price = raw ? Number(raw) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    throw new Error("Precio inválido.");
  }
  let slug = "";
  await withCurrentTenant(async (tx) => {
    const parcel = await tx.query.parcels.findFirst({
      where: eq(parcels.id, parcelId),
      with: { project: { columns: { slug: true } } },
    });
    if (!parcel) throw new Error("Parcela no encontrada.");
    slug = parcel.project.slug;
    await tx
      .update(parcels)
      .set({ price: price === null ? null : String(price) })
      .where(eq(parcels.id, parcelId));
  });
  revalidatePath(`/app/proyectos/${slug}`);
  revalidatePath("/app/proyectos");
}
