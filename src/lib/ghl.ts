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

  /** GET que no lanza: devuelve null si el recurso falla (opcionales). */
  async safeGet(path: string, params: Record<string, string> = {}) {
    try {
      return await this.get(path, params);
    } catch (e) {
      console.warn(`[ghl] ${path} falló:`, (e as Error).message);
      return null;
    }
  }

  /** Paginador genérico por meta.startAfter/startAfterId (contacts, opportunities). */
  private async paginate(
    path: string,
    itemsKey: string,
    extra: Record<string, string>,
    maxPages = 100,
  ): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    let startAfter: string | undefined;
    let startAfterId: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const params: Record<string, string> = { limit: "100", ...extra };
      if (startAfter) params.startAfter = startAfter;
      if (startAfterId) params.startAfterId = startAfterId;
      const data = await this.safeGet(path, params);
      if (!data) break;
      const batch = (data[itemsKey] ?? []) as Record<string, unknown>[];
      out.push(...batch);
      const meta = (data.meta ?? {}) as Record<string, unknown>;
      if (!batch.length || !meta.startAfterId || meta.startAfterId === startAfterId)
        break;
      startAfter = meta.startAfter != null ? String(meta.startAfter) : undefined;
      startAfterId = String(meta.startAfterId);
    }
    return out;
  }

  async allOpportunities(maxPages = 100): Promise<GhlOpportunity[]> {
    return this.paginate(
      "/opportunities/search",
      "opportunities",
      { location_id: this.locationId },
      maxPages,
    ) as Promise<GhlOpportunity[]>;
  }

  async allContacts(maxPages = 200): Promise<Record<string, unknown>[]> {
    return this.paginate(
      "/contacts/",
      "contacts",
      { locationId: this.locationId },
      maxPages,
    );
  }

  /** Conversaciones del location (paginado por startAfterDate/startAfterId). */
  async allConversations(maxPages = 200): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    let startAfterDate: string | undefined;
    let startAfterId: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const params: Record<string, string> = {
        locationId: this.locationId,
        limit: "100",
        sort: "desc",
        sortBy: "last_message_date",
      };
      if (startAfterDate) params.startAfterDate = startAfterDate;
      if (startAfterId) params.startAfterId = startAfterId;
      const data = await this.safeGet("/conversations/search", params);
      if (!data) break;
      const batch = (data.conversations ?? []) as Record<string, unknown>[];
      out.push(...batch);
      if (batch.length < 100) break;
      const last = batch[batch.length - 1];
      const nextDate = last.lastMessageDate ?? last.dateUpdated;
      if (!nextDate || String(nextDate) === startAfterDate) break;
      startAfterDate = String(nextDate);
      startAfterId = String(last.id);
    }
    return out;
  }

  /** Mensajes de una conversación (historial completo, incl. agente IA). */
  async messages(conversationId: string, maxPages = 50): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    let lastMessageId: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const params: Record<string, string> = { limit: "100" };
      if (lastMessageId) params.lastMessageId = lastMessageId;
      const data = await this.safeGet(`/conversations/${conversationId}/messages`, params);
      if (!data) break;
      const wrap = (data.messages ?? {}) as Record<string, unknown>;
      const batch = (wrap.messages ?? data.messages ?? []) as Record<string, unknown>[];
      if (!Array.isArray(batch) || !batch.length) break;
      out.push(...batch);
      const nextLast = wrap.lastMessageId ?? batch[batch.length - 1]?.id;
      if (!nextLast || String(nextLast) === lastMessageId || batch.length < 100) break;
      lastMessageId = String(nextLast);
    }
    return out;
  }

  async users(): Promise<Record<string, unknown>[]> {
    const d = await this.safeGet("/users/", { locationId: this.locationId });
    return (d?.users ?? []) as Record<string, unknown>[];
  }

  async customFields(): Promise<Record<string, unknown>[]> {
    const d = await this.safeGet(`/locations/${this.locationId}/customFields`);
    return (d?.customFields ?? []) as Record<string, unknown>[];
  }

  async tags(): Promise<Record<string, unknown>[]> {
    const d = await this.safeGet(`/locations/${this.locationId}/tags`);
    return (d?.tags ?? []) as Record<string, unknown>[];
  }

  async calendars(): Promise<Record<string, unknown>[]> {
    const d = await this.safeGet("/calendars/", { locationId: this.locationId });
    return (d?.calendars ?? []) as Record<string, unknown>[];
  }
}
