import { desc, eq } from "drizzle-orm";
import {
  clients,
  costs,
  moneyVouchers,
  parcelEvents,
  parcels,
  projects,
} from "@/db/schema";
import { toNumber } from "@/lib/money";
import { withCurrentTenant } from "@/lib/session";

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
    return project ?? null;
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
    return parcel ?? null;
  });
}

export function listClients() {
  return withCurrentTenant((tx) =>
    tx.query.clients.findMany({ orderBy: clients.name }),
  );
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
  return withCurrentTenant(async (tx) => {
    const rows = await tx
      .select({
        voucher: moneyVouchers,
        projectName: projects.name,
        parcelCode: parcels.code,
        clientName: clients.name,
      })
      .from(moneyVouchers)
      .leftJoin(projects, eq(moneyVouchers.projectId, projects.id))
      .leftJoin(parcels, eq(moneyVouchers.parcelId, parcels.id))
      .leftJoin(clients, eq(moneyVouchers.clientId, clients.id))
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
      totals: { ...totals, margenClp: totals.ingresosClp - totals.costosClp },
      projectCount: allProjects.length,
    };
  });
}
