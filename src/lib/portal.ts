import { createHmac } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { clientDocuments, clients, installments, parcels, paymentPlans, projects } from "@/db/schema";
import { withTenant } from "@/db/tenant";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret";
const DAYS_30 = 30 * 86_400_000;

type PortalPayload = { tenantId: string; clientId: string; exp: number };

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

/** Token firmado para el enlace mágico del portal del cliente (30 días). */
export function createPortalToken(tenantId: string, clientId: string): string {
  const body = Buffer.from(
    JSON.stringify({ tenantId, clientId, exp: Date.now() + DAYS_30 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyPortalToken(token: string | undefined): PortalPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || sign(body) !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as PortalPayload;
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

/** Datos que ve el cliente en su portal (alcance acotado a su persona). */
export function getPortalData(tenantId: string, clientId: string) {
  return withTenant(tenantId, async (tx) => {
    const client = await tx.query.clients.findFirst({
      where: eq(clients.id, clientId),
    });
    if (!client) return null;

    const ownedParcels = await tx
      .select({
        id: parcels.id,
        code: parcels.code,
        status: parcels.status,
        projectName: projects.name,
        comuna: projects.comuna,
      })
      .from(parcels)
      .leftJoin(projects, eq(parcels.projectId, projects.id))
      .where(eq(parcels.currentClientId, clientId));

    const parcelIds = ownedParcels.map((p) => p.id);
    const cuotas = parcelIds.length
      ? await tx
          .select()
          .from(installments)
          .where(inArray(installments.parcelId, parcelIds))
          .orderBy(installments.number)
      : [];
    const plans = parcelIds.length
      ? await tx
          .select()
          .from(paymentPlans)
          .where(inArray(paymentPlans.parcelId, parcelIds))
      : [];

    const documents = await tx
      .select()
      .from(clientDocuments)
      .where(eq(clientDocuments.clientId, clientId));

    const now = Date.now();
    const cuotasView = cuotas.map((c) => ({
      ...c,
      overdue: c.status === "pendiente" && new Date(c.dueDate).getTime() < now,
    }));
    return { client, parcels: ownedParcels, cuotas: cuotasView, plans, documents };
  });
}
