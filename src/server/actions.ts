"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import {
  clients,
  costs,
  invoices,
  moneyVouchers,
  parcelEvents,
  parcels,
  projects,
  type ParcelEventType,
} from "@/db/schema";
import { generateLandingCopy } from "@/lib/ai/claude";
import { getDteProvider } from "@/lib/dte";
import { EVENT_TO_STATUS } from "@/lib/labels";
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
  const repertorioCode = String(formData.get("repertorioCode") || "") || null;
  const note = String(formData.get("note") || "") || null;

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
  await requirePermission("parcels:write");
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) throw new Error("Nombre inválido");
  await withCurrentTenant((tx, { tenantId }) =>
    tx.insert(clients).values({
      tenantId,
      name,
      rut: String(formData.get("rut") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      email: String(formData.get("email") || "") || null,
    }),
  );
  revalidatePath("/app/proyectos");
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
