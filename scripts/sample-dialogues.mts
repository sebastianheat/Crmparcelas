/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Extrae diálogos reales (cliente ↔ agente) desde los mensajes clonados, para
 * analizar el comportamiento del agente IA de Toscana. Filtra logs de actividad.
 * Uso: NEON=... pnpm tsx scripts/sample-dialogues.mts [N]
 */
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.NEON!);
const N = Number(process.argv[2] ?? 60);

const ACTIVITY = /opportunity created|contact created|stage|moved to|tag added|note added|appointment|invalid|created by|updated by/i;

(async () => {
  const t = await sql`select m.tenant_id tid from memberships m join users u on u.id=m.user_id where u.email='admin@5000.cl' limit 1`;
  const TID = t[0].tid;
  // conversaciones con varios mensajes reales
  const rows: any[] = await sql`
    select external_id, payload from ghl_snapshots
    where kind='messages' and tenant_id=${TID} and (payload->>'n')::int >= 4
    order by random() limit ${N * 3}`;

  const dialogues: string[] = [];
  let used = 0;
  for (const r of rows) {
    if (used >= N) break;
    const msgs = (r.payload.messages ?? []) as any[];
    const conv = msgs
      .filter((m) => m.body && String(m.body).trim().length > 2 && !ACTIVITY.test(String(m.body)))
      .sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
    if (conv.length < 4) continue;
    const lines = conv.map((m) => {
      const who = m.direction === "inbound" ? "CLIENTE" : "AGENTE";
      return `${who}: ${String(m.body).replace(/\s+/g, " ").trim()}`;
    });
    dialogues.push(`--- Conversación ${used + 1} (${conv.length} mensajes) ---\n${lines.join("\n")}`);
    used++;
  }
  const out = dialogues.join("\n\n");
  writeFileSync("/tmp/dialogues.txt", out);
  console.log(`Extraídos ${used} diálogos reales → /tmp/dialogues.txt (${(out.length/1024).toFixed(0)} KB)`);
  console.log("\n===== MUESTRA (primeros 2) =====\n");
  console.log(dialogues.slice(0, 2).join("\n\n").slice(0, 1800));
})();
