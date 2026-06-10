/**
 * Cliente de la API de LeadConnector (GoHighLevel v2), usada por HEAT/Toscana.
 * Auth: Private Integration token (Settings → Private Integrations) del location.
 * Header obligatorio Version: 2021-07-28.
 */
const BASE = process.env.GHL_API_BASE ?? "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export type GhlStage = { id: string; name: string };
export type GhlOpportunity = {
  id: string;
  name?: string;
  monetaryValue?: number;
  pipelineId?: string;
  pipelineStageId?: string;
  source?: string;
  contact?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
};

export class GhlClient {
  constructor(
    private token: string,
    private locationId: string,
  ) {}

  private async get(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Version: VERSION,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`GHL ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return res.json();
  }

  /** Prueba de conexión: trae los pipelines del location. */
  async pipelines(): Promise<
    { id: string; name: string; stages: GhlStage[] }[]
  > {
    const data = await this.get("/opportunities/pipelines", {
      locationId: this.locationId,
    });
    return (data.pipelines ?? []) as {
      id: string;
      name: string;
      stages: GhlStage[];
    }[];
  }

  /** Itera todas las oportunidades del location (paginado). */
  async allOpportunities(maxPages = 30): Promise<GhlOpportunity[]> {
    const out: GhlOpportunity[] = [];
    let startAfter: string | undefined;
    let startAfterId: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const params: Record<string, string> = {
        location_id: this.locationId,
        limit: "100",
      };
      if (startAfter) params.startAfter = startAfter;
      if (startAfterId) params.startAfterId = startAfterId;
      const data = await this.get("/opportunities/search", params);
      const batch = (data.opportunities ?? []) as GhlOpportunity[];
      out.push(...batch);
      const meta = data.meta ?? {};
      if (!batch.length || !meta.startAfterId || meta.startAfterId === startAfterId) {
        break;
      }
      startAfter = meta.startAfter ? String(meta.startAfter) : undefined;
      startAfterId = String(meta.startAfterId);
    }
    return out;
  }
}
