import { and, count, desc, eq, inArray, lte, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  clients,
  bankMovements,
  clientDocuments,
  costs,
  ghlSnapshots,
  installments,
  integrations,
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
  projectUpdates,
  projects,
  promesaTemplates,
  sellerCompanies,
  users,
} from "@/db/schema";
import { db } from "@/db/client";
import { tenants } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { LEAD_ACTIVE_STAGES, LEAD_WON_STAGES } from "@/lib/labels";
import { toNumber } from "@/lib/money";
import { SELLER_ROLES } from "@/lib/roles";
import { requireSession, withCurrentTenant } from "@/lib/session";

/** Empresas (tenants) a las que el usuario actual tiene acceso, + la activa. */
export async function listUserTenants() {
  const session = await requireSession();
  const rows = await db.query.memberships.findMany({
    where: eq(memberships.userId, session.user.id),
    with: { tenant: { columns: { id: true, name: true, slug: true } } },
  });
  return {
    activeTenantId: session.tenantId,
    tenants: rows
      .map((r) => ({ id: r.tenant.id, name: r.tenant.name, role: r.role }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ─── Público (landing / mapa de stock compartible por URL) ────────────────────

export async function getPublicProject(tenantSlug: string, projectSlug: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, tenantSlug),
  });
  if (!tenant) return null;
  return withTenant(tenant.id, async (tx) => {
    const project = await tx.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
      with: { parcels: { orderBy: parcels.code } },
    });
    if (!project) return null;
    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        brandPrimary: tenant.brandPrimary,
        brandSecondary: tenant.brandSecondary,
        logoUrl: tenant.logoUrl,
      },
      project,
    };
  });
}

// ─── Proyectos ────────────────────────────────────────────────────────────────

export function listProjects() {
  return withCurrentTenant(async (tx) => {
    const rows = await tx.query.projects.findMany({
      orderBy: desc(projects.createdAt),
      with: { parcels: { columns: { id: true, status: true, price: true } } },
    });
    return rows.map((p) => {
      const total = p.parcels.length;
      const libres = p.parcels.filter((x) => x.status === "disponible").length;
      return { ...p, totalUnits: total, freeUnits: libres };
    });
  });
}

export function getProjectBySlug(slug: string) {
  return withCurrentTenant(async (tx) => {
    const project = await tx.query.projects.findFirst({
      where: eq(projects.slug, slug),
      with: {
        parcels: {
          orderBy: parcels.code,
          with: { currentClient: { columns: { name: true } } },
        },
      },
    });
    if (!project) return null;
    const documents = await tx
      .select()
      .from(projectDocuments)
      .where(eq(projectDocuments.projectId, project.id))
      .orderBy(desc(projectDocuments.createdAt));
    const updates = await tx
      .select()
      .from(projectUpdates)
      .where(eq(projectUpdates.projectId, project.id))
      .orderBy(desc(projectUpdates.createdAt));
    return { ...project, documents, updates };
  });
}

/**
 * Avances publicados de los proyectos donde el cliente tiene parcela.
 * Para el portal del cliente: agrupa por proyecto, marca demoras
 * (plazo con dueDate vencido y sin doneAt).
 */
export function getClientProjectUpdates(projectIds: string[]) {
  if (projectIds.length === 0) return Promise.resolve([]);
  return withCurrentTenant(async (tx) => {
    const rows = await tx
      .select({
        upd: projectUpdates,
        projectName: projects.name,
      })
      .from(projectUpdates)
      .leftJoin(projects, eq(projectUpdates.projectId, projects.id))
      .where(
        and(
          inArray(projectUpdates.projectId, projectIds),
          eq(projectUpdates.published, true),
        ),
      )
      .orderBy(desc(projectUpdates.createdAt));
    const now = Date.now();
    return rows.map((r) => ({
      ...r.upd,
      projectName: r.projectName,
      demora:
        r.upd.kind === "plazo" &&
        !r.upd.doneAt &&
        r.upd.dueDate != null &&
        new Date(r.upd.dueDate).getTime() < now,
    }));
  });
}

export function getParcel(id: string) {
  return withCurrentTenant(async (tx) => {
    const parcel = await tx.query.parcels.findFirst({
      where: eq(parcels.id, id),
      with: {
        project: true,
        currentClient: true,
        events: {
          orderBy: desc(parcelEvents.createdAt),
          with: { client: { columns: { name: true } } },
        },
      },
    });
    if (!parcel) return null;
    const documents = await tx
      .select()
      .from(parcelDocuments)
      .where(eq(parcelDocuments.parcelId, id))
      .orderBy(desc(parcelDocuments.createdAt));
    const plan = await tx.query.paymentPlans.findFirst({
      where: eq(paymentPlans.parcelId, id),
      orderBy: desc(paymentPlans.createdAt),
    });
    const rawInstallments = plan
      ? await tx
          .select()
          .from(installments)
          .where(eq(installments.planId, plan.id))
          .orderBy(installments.number)
      : [];
    const now = Date.now();
    const planInstallments = rawInstallments.map((c) => ({
      ...c,
      overdue:
        c.status === "pendiente" && new Date(c.dueDate).getTime() < now,
    }));
    return { ...parcel, documents, plan: plan ?? null, installments: planInstallments };
  });
}

// ─── Cobranza (dashboard de cuotas) ───────────────────────────────────────────

/** Cuotas en formato plano para exportación / reportes. */
export function getInstallmentsExport() {
  return withCurrentTenant((tx) =>
    tx
      .select({
        inst: installments,
        parcelCode: parcels.code,
        projectName: projects.name,
        clientName: clients.name,
      })
      .from(installments)
      .leftJoin(parcels, eq(installments.parcelId, parcels.id))
      .leftJoin(projects, eq(parcels.projectId, projects.id))
      .leftJoin(clients, eq(parcels.currentClientId, clients.id))
      .orderBy(installments.dueDate),
  );
}

/** Vista previa de cuántos recordatorios se generarían. */
export function getRemindersPreview() {
  return withCurrentTenant(async (tx) => {
    const now = Date.now();
    const t3 = new Date(now + 3 * 86_400_000);
    const cuotas = await tx
      .select({ id: installments.id, dueDate: installments.dueDate })
      .from(installments)
      .where(
        and(
          eq(installments.status, "pendiente"),
          lte(installments.dueDate, t3),
        ),
      );
    const vencidas = cuotas.filter((c) => new Date(c.dueDate).getTime() < now).length;
    const porVencer = cuotas.length - vencidas;

    const activos = await tx
      .select({
        lastContactAt: leads.lastContactAt,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(inArray(leads.stage, [...LEAD_ACTIVE_STAGES]));
    const leadsStale = activos.filter(
      (l) => now - (l.lastContactAt ?? l.createdAt).getTime() > 3 * 86_400_000,
    ).length;

    return { vencidas, porVencer, leadsStale };
  });
}

// ─── Flujo de caja proyectado (desde las cuotas comprometidas) ────────────────

export function getCashFlow() {
  return withCurrentTenant(async (tx) => {
    const rows = await tx
      .select({
        inst: installments,
        projectName: projects.name,
      })
      .from(installments)
      .leftJoin(parcels, eq(installments.parcelId, parcels.id))
      .leftJoin(projects, eq(parcels.projectId, projects.id));

    const n = (v: string | number | null) => toNumber(v) ?? 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 12 meses hacia adelante.
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
        projected: 0,
      };
    });
    const monthIdx = new Map(months.map((m, i) => [m.key, i]));

    let comprometido = 0;
    let vencido = 0;
    let prox30 = 0;
    let prox90 = 0;
    let recaudado = 0;
    const byProject = new Map<string, number>();

    for (const r of rows) {
      const amt = n(r.inst.amountClp);
      if (r.inst.status === "pagada") {
        recaudado += amt;
        continue;
      }
      if (r.inst.status !== "pendiente") continue;
      comprometido += amt;
      const due = new Date(r.inst.dueDate);
      const pname = r.projectName ?? "—";
      byProject.set(pname, (byProject.get(pname) ?? 0) + amt);

      if (due < startOfMonth) {
        vencido += amt;
      } else {
        const key = `${due.getFullYear()}-${due.getMonth()}`;
        const idx = monthIdx.get(key);
        if (idx != null) months[idx].projected += amt;
      }
      const diffDays = (due.getTime() - now.getTime()) / 86_400_000;
      if (diffDays >= 0 && diffDays <= 30) prox30 += amt;
      if (diffDays >= 0 && diffDays <= 90) prox90 += amt;
    }

    const projects_ = [...byProject.entries()]
      .map(([name, monto]) => ({ name, monto }))
      .sort((a, b) => b.monto - a.monto);
    const maxMonth = Math.max(1, ...months.map((m) => m.projected));

    return {
      months,
      maxMonth,
      byProject: projects_,
      totals: { comprometido, vencido, prox30, prox90, recaudado },
    };
  });
}

export function getCobranza() {
  return withCurrentTenant(async (tx) => {
    const rows = await tx
      .select({
        inst: installments,
        parcelCode: parcels.code,
        projectName: projects.name,
        clientName: clients.name,
      })
      .from(installments)
      .leftJoin(parcels, eq(installments.parcelId, parcels.id))
      .leftJoin(projects, eq(parcels.projectId, projects.id))
      .leftJoin(clients, eq(parcels.currentClientId, clients.id))
      .orderBy(installments.dueDate);

    const now = Date.now();
    const n = (v: string | number | null) => toNumber(v) ?? 0;
    let recaudado = 0;
    let pendiente = 0;
    let vencido = 0;
    const vencidas: typeof rows = [];
    const proximas: typeof rows = [];
    for (const r of rows) {
      if (r.inst.status === "pagada") {
        recaudado += n(r.inst.amountClp);
        continue;
      }
      if (r.inst.status === "condonada") continue;
      pendiente += n(r.inst.amountClp);
      const due = new Date(r.inst.dueDate).getTime();
      if (due < now) {
        vencido += n(r.inst.amountClp);
        vencidas.push(r);
      } else {
        proximas.push(r);
      }
    }
    return {
      totals: { recaudado, pendiente, vencido },
      vencidas,
      proximas: proximas.slice(0, 50),
    };
  });
}

export function listSellerCompanies() {
  return withCurrentTenant((tx) =>
    tx.query.sellerCompanies.findMany({ orderBy: sellerCompanies.razonSocial }),
  );
}

export function getCommissions() {
  return withCurrentTenant(async (tx) => {
    const mems = await tx
      .select({
        userId: memberships.userId,
        role: memberships.role,
        pct: memberships.commissionPct,
        name: users.name,
        email: users.email,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id));

    // Cobros (comprobantes de dinero) atribuidos a cada vendedor.
    const cobrosRows = await tx
      .select({
        sellerUserId: moneyVouchers.sellerUserId,
        total: sum(moneyVouchers.amountClp),
      })
      .from(moneyVouchers)
      .groupBy(moneyVouchers.sellerUserId);
    const cobrosBySeller = new Map<string, number>();
    for (const r of cobrosRows) {
      if (r.sellerUserId) cobrosBySeller.set(r.sellerUserId, toNumber(r.total) ?? 0);
    }

    const rows = mems
      .map((m) => {
        const cobros = cobrosBySeller.get(m.userId) ?? 0;
        const pct = toNumber(m.pct) ?? 0;
        return {
          userId: m.userId,
          name: m.name ?? m.email,
          role: m.role,
          pct,
          cobros,
          comision: Math.round((cobros * pct) / 100),
        };
      })
      // Mostrar vendedores y/o quienes tengan cobros o tasa configurada.
      .filter((r) => r.role === "vendedor" || r.cobros > 0 || r.pct > 0)
      .sort((a, b) => b.comision - a.comision);

    const totals = rows.reduce(
      (a, r) => ({
        cobros: a.cobros + r.cobros,
        comision: a.comision + r.comision,
      }),
      { cobros: 0, comision: 0 },
    );
    return { rows, totals };
  });
}

// ─── CRM — Leads y embudo ─────────────────────────────────────────────────────

export function getCloneStatus() {
  return withCurrentTenant(async (tx) => {
    const rows = await tx
      .select({ kind: ghlSnapshots.kind, n: count() })
      .from(ghlSnapshots)
      .groupBy(ghlSnapshots.kind);
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.kind] = Number(r.n);
    const [{ n: clientCount }] = await tx.select({ n: count() }).from(clients);
    const [{ n: leadCount }] = await tx.select({ n: count() }).from(leads);
    return { counts, clientCount: Number(clientCount), leadCount: Number(leadCount) };
  });
}

export function getGhlIntegration() {
  return withCurrentTenant(async (tx) => {
    const row = await tx.query.integrations.findFirst({
      where: eq(integrations.provider, "ghl"),
    });
    return {
      configured: Boolean(row?.config?.token),
      locationId: row?.config?.locationId ?? "",
      lastSyncAt: row?.lastSyncAt ?? null,
    };
  });
}

export function listLeads() {
  return withCurrentTenant(async (tx) => {
    const assignee = alias(users, "assignee");
    const rows = await tx
      .select({
        lead: leads,
        assignedName: assignee.name,
        projectName: projects.name,
      })
      .from(leads)
      .leftJoin(assignee, eq(leads.assignedToUserId, assignee.id))
      .leftJoin(projects, eq(leads.projectId, projects.id))
      .orderBy(desc(leads.updatedAt));

    const won = new Set(LEAD_WON_STAGES);
    const stageCounts: Record<string, number> = {};
    let activos = 0;
    let ganados = 0;
    let pipelineValue = 0;
    for (const r of rows) {
      stageCounts[r.lead.stage] = (stageCounts[r.lead.stage] ?? 0) + 1;
      if (won.has(r.lead.stage)) ganados += 1;
      else if (r.lead.stage !== "perdido") {
        activos += 1;
        pipelineValue += toNumber(r.lead.estimatedValueClp) ?? 0;
      }
    }
    const cerrados = ganados + (stageCounts["perdido"] ?? 0);
    const conversion = cerrados > 0 ? Math.round((ganados / cerrados) * 100) : 0;
    return {
      rows,
      stats: {
        total: rows.length,
        activos,
        ganados,
        conversion,
        pipelineValue,
      },
      stageCounts,
    };
  });
}

export function getLead(id: string) {
  return withCurrentTenant(async (tx) => {
    const assignee = alias(users, "assignee");
    const author = alias(users, "author");
    const [row] = await tx
      .select({
        lead: leads,
        assignedName: assignee.name,
        projectName: projects.name,
      })
      .from(leads)
      .leftJoin(assignee, eq(leads.assignedToUserId, assignee.id))
      .leftJoin(projects, eq(leads.projectId, projects.id))
      .where(eq(leads.id, id))
      .limit(1);
    if (!row) return null;
    const activities = await tx
      .select({
        activity: leadActivities,
        authorName: author.name,
      })
      .from(leadActivities)
      .leftJoin(author, eq(leadActivities.createdByUserId, author.id))
      .where(eq(leadActivities.leadId, id))
      .orderBy(desc(leadActivities.createdAt));
    return { ...row, activities };
  });
}

export function getConciliacion() {
  return withCurrentTenant(async (tx) => {
    const voucher = {
      id: moneyVouchers.id,
      folio: moneyVouchers.folio,
      concept: moneyVouchers.concept,
      amountClp: moneyVouchers.amountClp,
    };
    const rows = await tx
      .select({
        mv: bankMovements,
        voucherFolio: moneyVouchers.folio,
        voucherConcept: moneyVouchers.concept,
      })
      .from(bankMovements)
      .leftJoin(moneyVouchers, eq(bankMovements.matchedVoucherId, moneyVouchers.id))
      .orderBy(desc(bankMovements.postedAt));

    // Comprobantes disponibles para casar manualmente.
    const vouchers = await tx
      .select(voucher)
      .from(moneyVouchers)
      .orderBy(desc(moneyVouchers.folio));

    const n = (v: string | number | null) => toNumber(v) ?? 0;
    let conciliado = 0;
    let pendiente = 0;
    let abonos = 0;
    for (const r of rows) {
      const amt = n(r.mv.amountClp);
      if (amt > 0) abonos += amt;
      if (r.mv.status === "conciliado") conciliado += amt;
      else if (r.mv.status === "pendiente" && amt > 0) pendiente += amt;
    }
    const provider = process.env.BANK_PROVIDER ?? "mock";
    return {
      rows,
      vouchers,
      provider,
      connected: provider !== "mock",
      totals: { conciliado, pendiente, abonos },
    };
  });
}

export function listLegalCases() {
  return withCurrentTenant(async (tx) => {
    const rows = await tx
      .select({
        c: legalCases,
        projectName: projects.name,
      })
      .from(legalCases)
      .leftJoin(projects, eq(legalCases.projectId, projects.id))
      .orderBy(desc(legalCases.createdAt));
    const vigentes = rows.filter((r) => r.c.status === "vigente").length;
    const perjuicioTotal = rows.reduce(
      (a, r) => a + (toNumber(r.c.perjuicioClp) ?? 0),
      0,
    );
    return { rows, totals: { vigentes, perjuicioTotal, total: rows.length } };
  });
}

export function listPromesaTemplates() {
  return withCurrentTenant((tx) =>
    tx.query.promesaTemplates.findMany({
      orderBy: desc(promesaTemplates.isDefault),
    }),
  );
}

export function listClients() {
  return withCurrentTenant((tx) =>
    tx.query.clients.findMany({ orderBy: clients.name }),
  );
}

/**
 * Clientes con su proyecto/parcela y el número de documentos ya cargados.
 * Para la página de carga masiva de la carpeta digital.
 */
export function listClientsForUpload() {
  return withCurrentTenant(async (tx) => {
    const rows = await tx
      .select({
        id: clients.id,
        name: clients.name,
        rut: clients.rut,
        parcelCode: parcels.code,
        projectName: projects.name,
        docCount: count(clientDocuments.id),
      })
      .from(clients)
      .leftJoin(parcels, eq(parcels.currentClientId, clients.id))
      .leftJoin(projects, eq(parcels.projectId, projects.id))
      .leftJoin(clientDocuments, eq(clientDocuments.clientId, clients.id))
      .groupBy(
        clients.id,
        clients.name,
        clients.rut,
        parcels.code,
        projects.name,
      )
      .orderBy(projects.name, clients.name);
    return rows;
  });
}

export function getClient(id: string) {
  return withCurrentTenant(async (tx) => {
    const client = await tx.query.clients.findFirst({
      where: eq(clients.id, id),
    });
    if (!client) return null;
    const documents = await tx
      .select()
      .from(clientDocuments)
      .where(eq(clientDocuments.clientId, id))
      .orderBy(desc(clientDocuments.createdAt));
    const ownedParcels = await tx
      .select({
        id: parcels.id,
        code: parcels.code,
        status: parcels.status,
        projectName: projects.name,
      })
      .from(parcels)
      .leftJoin(projects, eq(parcels.projectId, projects.id))
      .where(eq(parcels.currentClientId, id));
    return { ...client, documents, parcels: ownedParcels };
  });
}

// ─── Equipo (usuarios y roles) ────────────────────────────────────────────────

export function listMembers() {
  return withCurrentTenant(async (tx, { tenantId }) =>
    tx
      .select({
        membershipId: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        createdAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.tenantId, tenantId))
      .orderBy(users.name),
  );
}

/** Miembros que pueden figurar como vendedor responsable de una reserva. */
export function listSellers() {
  return withCurrentTenant(async (tx, { tenantId }) => {
    const rows = await tx
      .select({
        userId: users.id,
        name: users.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.tenantId, tenantId))
      .orderBy(users.name);
    return rows.filter((r) => SELLER_ROLES.includes(r.role));
  });
}

// ─── Prefacturación ───────────────────────────────────────────────────────────

export function listVouchers() {
  return withCurrentTenant((tx) =>
    tx.query.moneyVouchers.findMany({
      orderBy: desc(moneyVouchers.issuedAt),
      with: {},
    }),
  );
}

export function getVouchersDetailed() {
  const sellerUser = alias(users, "seller_user");
  const validatorUser = alias(users, "validator_user");
  return withCurrentTenant(async (tx) => {
    const rows = await tx
      .select({
        voucher: moneyVouchers,
        projectName: projects.name,
        parcelCode: parcels.code,
        clientName: clients.name,
        sellerName: sellerUser.name,
        validatedByName: validatorUser.name,
      })
      .from(moneyVouchers)
      .leftJoin(projects, eq(moneyVouchers.projectId, projects.id))
      .leftJoin(parcels, eq(moneyVouchers.parcelId, parcels.id))
      .leftJoin(clients, eq(moneyVouchers.clientId, clients.id))
      .leftJoin(sellerUser, eq(moneyVouchers.sellerUserId, sellerUser.id))
      .leftJoin(
        validatorUser,
        eq(moneyVouchers.validatedByUserId, validatorUser.id),
      )
      .orderBy(desc(moneyVouchers.issuedAt));
    return rows;
  });
}

// ─── Costos ───────────────────────────────────────────────────────────────────

export function getCostsDetailed() {
  return withCurrentTenant((tx) =>
    tx
      .select({ cost: costs, projectName: projects.name })
      .from(costs)
      .leftJoin(projects, eq(costs.projectId, projects.id))
      .orderBy(desc(costs.incurredAt)),
  );
}

// ─── Dashboard financiero (M9) ────────────────────────────────────────────────

export type ProjectFinancials = {
  id: string;
  name: string;
  slug: string;
  status: string;
  legalStatus: string;
  riesgo: string;
  denuncias: number;
  propio: boolean;
  totalUnits: number;
  freeUnits: number;
  ingresosClp: number; // dinero efectivamente ingresado (comprobantes)
  prometidoClp: number; // valor de parcelas prometidas
  escrituradoClp: number; // valor de parcelas escrituradas/inscritas/entregadas
  costosClp: number;
  margenClp: number; // ingresos - costos (caja)
};

export function getDashboard() {
  return withCurrentTenant(async (tx) => {
    const [allProjects, allParcels, allVouchers, allCosts] = await Promise.all([
      tx.query.projects.findMany(),
      tx.query.parcels.findMany(),
      tx.query.moneyVouchers.findMany(),
      tx.query.costs.findMany(),
    ]);

    const byProject = new Map<string, ProjectFinancials>();
    for (const p of allProjects) {
      byProject.set(p.id, {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        legalStatus: p.legalStatus,
        riesgo: p.riesgo,
        denuncias: p.denuncias,
        propio: p.propio,
        totalUnits: 0,
        freeUnits: 0,
        ingresosClp: 0,
        prometidoClp: 0,
        escrituradoClp: 0,
        costosClp: 0,
        margenClp: 0,
      });
    }

    const escrituradoStates = new Set([
      "escriturada",
      "inscrita",
      "entregada",
    ]);

    for (const parcel of allParcels) {
      const f = byProject.get(parcel.projectId);
      if (!f) continue;
      f.totalUnits += 1;
      if (parcel.status === "disponible") f.freeUnits += 1;
      const price = toNumber(parcel.price) ?? 0;
      if (parcel.status === "prometida") f.prometidoClp += price;
      if (escrituradoStates.has(parcel.status)) f.escrituradoClp += price;
    }

    for (const v of allVouchers) {
      if (v.status === "anulado") continue;
      const f = byProject.get(v.projectId);
      if (!f) continue;
      f.ingresosClp += toNumber(v.amountClp) ?? 0;
    }

    for (const c of allCosts) {
      if (!c.projectId) continue;
      const f = byProject.get(c.projectId);
      if (!f) continue;
      f.costosClp += toNumber(c.amountClp) ?? 0;
    }

    const list = [...byProject.values()].map((f) => ({
      ...f,
      margenClp: f.ingresosClp - f.costosClp,
    }));

    const totals = list.reduce(
      (acc, f) => ({
        ingresosClp: acc.ingresosClp + f.ingresosClp,
        prometidoClp: acc.prometidoClp + f.prometidoClp,
        escrituradoClp: acc.escrituradoClp + f.escrituradoClp,
        costosClp: acc.costosClp + f.costosClp,
        totalUnits: acc.totalUnits + f.totalUnits,
        freeUnits: acc.freeUnits + f.freeUnits,
      }),
      {
        ingresosClp: 0,
        prometidoClp: 0,
        escrituradoClp: 0,
        costosClp: 0,
        totalUnits: 0,
        freeUnits: 0,
      },
    );

    return {
      projects: list,
      totals: {
        ...totals,
        margenClp: totals.ingresosClp - totals.costosClp,
        riesgoAlto: list.filter((f) => f.riesgo === "alto").length,
        denunciasTotal: list.reduce((a, f) => a + f.denuncias, 0),
      },
      projectCount: allProjects.length,
    };
  });
}
