/**
 * Resincroniza planes de pago de San Clemente (Century 21) con la planilla:
 * "Pagado contado" = acumulado real pagado; pares de meses = historial.
 * Corrige el doble conteo (pie + cuotas repetidas) de la carga original.
 *  - pagado ≥ valor → venta contado pagada: se elimina el plan (el libro la
 *    cuenta por su valor).
 *  - pagado < valor → plan: pie = pagado − hist_pagado; cuotas del historial
 *    (pagada si fecha ≤ hoy, pendiente si futura).
 *  - sin datos de pago → no se toca.
 * Args: <sc_resync.json> [--dry]
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const [jsonPath] = process.argv.slice(2);
const DRY = process.argv.includes("--dry");
const HOY = "2026-07-03";
const sql = neon(process.env.REMOTE_DATABASE_URL!);
const data = JSON.parse(readFileSync(jsonPath, "utf8")) as any[];
const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

async function main() {
  const t = (await sql`select id from tenants where name='Century 21 Quantum'`) as any[];
  const tid = t[0].id as string;
  const proj = (await sql`select id from projects where tenant_id=${tid} limit 1`) as any[];
  const projectId = proj[0].id as string;
  const prows = (await sql`select p.id, p.code, p.current_client_id as client_id, c.name as client
    from parcels p left join clients c on c.id=p.current_client_id where p.tenant_id=${tid}`) as any[];
  const byNum = new Map<number, any[]>();
  for (const p of prows) {
    const num = Number((String(p.code).match(/^L-(\d+)/) || [])[1] || 0);
    (byNum.get(num) ?? byNum.set(num, []).get(num)!).push(p);
  }
  const seen = new Set<string>();
  let contado = 0, planes = 0, cuotas = 0, skip = 0;
  const misses: string[] = [];

  for (const rec of data) {
    if (!rec.pagado && !rec.hist.length) { skip++; continue; }
    const cands = (byNum.get(rec.lote) || []).filter((c) => !seen.has(c.id));
    if (!cands.length) { misses.push(`lote ${rec.lote} (${rec.nombre})`); continue; }
    const ftok = new Set(norm(rec.nombre).split(" ").filter((w) => w.length >= 3));
    let best = cands[0], bestScore = -1;
    for (const c of cands) {
      const ctok = new Set(norm(c.client || "").split(" ").filter((w: string) => w.length >= 3));
      let s = 0;
      for (const tk of ftok) if (ctok.has(tk)) s++;
      if (s > bestScore) { bestScore = s; best = c; }
    }
    seen.add(best.id);

    const histPag = rec.hist.filter((h: any) => h.fecha <= HOY);
    const histPend = rec.hist.filter((h: any) => h.fecha > HOY);
    const sumPag = histPag.reduce((a: number, h: any) => a + h.monto, 0);

    if (DRY) {
      if (rec.pagado >= rec.valor && !histPend.length) contado++;
      else { planes++; cuotas += rec.hist.length; }
      continue;
    }
    await sql.transaction([
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`delete from payment_plans where parcel_id = ${best.id}`,
    ]);
    if (rec.pagado >= rec.valor && !histPend.length) { contado++; continue; }

    const planId = randomUUID();
    const pie = Math.max(0, rec.pagado - sumPag);
    const stmts: any[] = [
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`insert into payment_plans (id, tenant_id, parcel_id, project_id, client_id, total_clp, pie_clp, n_cuotas, status)
        values (${planId}, ${tid}, ${best.id}, ${projectId}, ${best.client_id}, ${rec.valor}, ${pie}, ${rec.hist.length}, ${"vigente"})`,
    ];
    rec.hist.forEach((h: any, i: number) => {
      const paid = h.fecha <= HOY;
      stmts.push(sql`insert into installments (tenant_id, plan_id, parcel_id, number, due_date, amount_clp, status, paid_at)
        values (${tid}, ${planId}, ${best.id}, ${i + 1}, ${h.fecha}, ${h.monto}, ${paid ? "pagada" : "pendiente"}, ${paid ? h.fecha : null})`);
    });
    await sql.transaction(stmts);
    planes++; cuotas += rec.hist.length;
  }
  console.log(`${DRY ? "[DRY] " : ""}contado pagado (sin plan): ${contado} · planes crédito: ${planes} · cuotas: ${cuotas} · sin datos (no tocados): ${skip}`);
  if (misses.length) console.log("sin parcela:", misses.join(" | "));
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
