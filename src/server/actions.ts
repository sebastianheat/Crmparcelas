"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { and, desc, eq, isNotNull, max } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import { withTenant } from "@/db/tenant";
import {
  bankMovements,
  clientDocuments,
  clients,
  costs,
  installments,
  invoices,
  leadActivities,
  leads,
  legalCases,
  memberships,
  moneyVouchers,
  parcelDocuments,
  parcelEvents,
  parcels,
  paymentPlans,
  projectDocuments,
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
import { EVENT_TO_STATUS } from "@/lib/labels";
import { generateReservaPdf, renderDocumentPdf } from "@/lib/pdf";
import { generatePromesaText } from "@/lib/promesa";
import { storeFile } from "@/lib/storage";
import { getBankProvider } from "@/lib/bank";
import { handleInboundWhatsApp } from "@/lib/whatsapp/agent";
import { runRemindersForTenant } from "@/lib/reminders";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import { withCurrentTenant, requirePermission } from "@/lib/session";

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
    });
    if (!inst) throw new Error("Cuota no encontrada.");
    parcelId = inst.parcelId;
    const parcel = await tx.query.parcels.findFirst({
      where: eq(parcels.id, inst.parcelId),
      columns: { code: true, projectId: true },
    });
    if (!parcel) throw new Error("Parcela no encontrada.");

    // Vendedor responsable (de la reserva/venta) para atribuir la comisión.
    const sale = await tx.query.parcelEvents.findFirst({
      where: and(
        eq(parcelEvents.parcelId, inst.parcelId),
        isNotNull(parcelEvents.sellerUserId),
      ),
      orderBy: desc(parcelEvents.createdAt),
      columns: { sellerUserId: true },
    });

    // Comprobante de dinero por la cuota (entra a prefacturación).
    const [{ value: lastFolio }] = await tx
      .select({ value: max(moneyVouchers.folio) })
      .from(moneyVouchers);
    const [voucher] = await tx
      .insert(moneyVouchers)
      .values({
        tenantId,
        projectId: parcel.projectId,
        parcelId: inst.parcelId,
        folio: (lastFolio ?? 0) + 1,
        concept: `Cuota ${inst.number} parcela ${parcel.code}`,
        amountClp: inst.amountClp,
        sellerUserId: sale?.sellerUserId ?? null,
        createdByUserId: userId,
      })
      .returning();

    await tx
      .update(installments)
      .set({ status: "pagada", paidAt: new Date(), voucherId: voucher.id })
      .where(eq(installments.id, installmentId));
  });
  if (parcelId) revalidatePath(`/app/parcelas/${parcelId}`);
  revalidatePath("/app/cobranza");
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
  await withCurrentTenant(async (tx, { tenantId }) => {
    const provider = getBankProvider();

    // Sincronización incremental: desde el último movimiento registrado.
    const last = await tx.query.bankMovements.findFirst({
      orderBy: desc(bankMovements.postedAt),
      columns: { postedAt: true },
    });
    const since = last ? new Date(last.postedAt) : undefined;

    const movements = await provider.listMovements({ since });
    for (const m of movements) {
      await tx
        .insert(bankMovements)
        .values({
          tenantId,
          provider: provider.name,
          externalId: m.externalId,
          postedAt: m.postedAt,
          amountClp: String(m.amountClp),
          description: m.description ?? null,
          counterparty: m.counterparty ?? null,
          raw: m.raw ?? {},
        })
        .onConflictDoNothing({
          target: [bankMovements.tenantId, bankMovements.externalId],
        });
    }

    // Casado automático: abonos pendientes contra comprobantes por monto exacto.
    const pendientes = await tx.query.bankMovements.findMany({
      where: eq(bankMovements.status, "pendiente"),
    });
    const vouchers = await tx.query.moneyVouchers.findMany({
      columns: { id: true, amountClp: true },
    });
    const alreadyMatched = new Set(
      (
        await tx.query.bankMovements.findMany({
          columns: { matchedVoucherId: true },
        })
      )
        .map((b) => b.matchedVoucherId)
        .filter(Boolean) as string[],
    );

    for (const mv of pendientes) {
      const amount = Number(mv.amountClp);
      if (amount <= 0) continue; // solo abonos
      const candidates = vouchers.filter(
        (v) => Number(v.amountClp) === amount && !alreadyMatched.has(v.id),
      );
      if (candidates.length === 1) {
        const vid = candidates[0].id;
        await tx
          .update(bankMovements)
          .set({ status: "conciliado", matchedVoucherId: vid, reconciledAt: new Date() })
          .where(eq(bankMovements.id, mv.id));
        alreadyMatched.add(vid);
      }
    }
  });
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
