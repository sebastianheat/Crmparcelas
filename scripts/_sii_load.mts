/**
 * Carga los documentos SII de Metacon (Terraplanet) a tax_documents:
 * sube cada archivo a Blob privado, clasifica por tipo/período y parsea la
 * meta contable (folio+fecha+pago de F29, totales neto/IVA de los RCV).
 * Args: <dir>
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";

const DIR = process.argv[2];
const sql = neon(process.env.REMOTE_DATABASE_URL!);
const mimeOf = (f: string) => {
  const e = f.toLowerCase().split(".").pop();
  return e === "pdf" ? "application/pdf" : e === "csv" ? "text/csv"
    : e === "md" ? "text/markdown" : e === "json" ? "application/json"
    : "application/octet-stream";
};
const per = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}`;

function classify(f: string): { kind: string; period: string | null } {
  let m;
  if ((m = f.match(/^Cert_F29_(\d{4})-(\d{2})/))) return { kind: "f29_cert", period: `${m[1]}-${m[2]}` };
  if ((m = f.match(/^F29_(\d{4})-(\d{2})/))) return { kind: "f29", period: `${m[1]}-${m[2]}` };
  if ((m = f.match(/^RCV_RESUMEN_COMPRA_REGISTRO_\d+_(\d{6})/))) return { kind: "rcv_compra_resumen", period: per(m[1]) };
  if ((m = f.match(/^RCV_COMPRA_REGISTRO_[\d-]+_(\d{6})/))) return { kind: "rcv_compra", period: per(m[1]) };
  if ((m = f.match(/^RCV_RESUMEN_VENTA_\d+_(\d{6})/))) return { kind: "rcv_venta_resumen", period: per(m[1]) };
  if ((m = f.match(/^RCV_VENTA_[\d-]+_(\d{6})/))) return { kind: "rcv_venta", period: per(m[1]) };
  if (/^F22/i.test(f)) return { kind: "f22", period: null };
  if (/^Informe_Tributario/i.test(f)) return { kind: "informe", period: null };
  return { kind: "otro", period: null };
}

function parseCsvResumen(path: string) {
  // filas: Tipo Documento;Total Documentos;Monto Exento;Monto Neto;IVA...;Monto Total
  const lines = readFileSync(path, "latin1").split("\n").filter((l) => l.trim());
  let docs = 0, exento = 0, neto = 0, iva = 0, total = 0;
  for (const l of lines.slice(1)) {
    const c = l.split(";");
    if (c.length < 5 || !/\(\d+\)/.test(c[0])) continue;
    docs += Number(c[1]) || 0;
    exento += Number(c[2]) || 0;
    neto += Number(c[3]) || 0;
    iva += Number(c[4]) || 0;
    total += Number(c[c.length - 1]) || 0;
  }
  return { docs, exento, neto, iva, total };
}
function parseCsvDetalle(path: string) {
  const lines = readFileSync(path, "latin1").split("\n").filter((l) => l.trim());
  const hdr = lines[0].split(";");
  const iEx = hdr.findIndex((h) => /Monto Exento/i.test(h));
  const iNe = hdr.findIndex((h) => /Monto Neto/i.test(h));
  const iIv = hdr.findIndex((h) => /^Monto IVA/i.test(h));
  const iTo = hdr.findIndex((h) => /Monto total/i.test(h));
  let docs = 0, exento = 0, neto = 0, iva = 0, total = 0;
  for (const l of lines.slice(1)) {
    const c = l.split(";");
    if (c.length < 8) continue;
    docs++; exento += Number(c[iEx]) || 0; neto += Number(c[iNe]) || 0;
    iva += Number(c[iIv]) || 0; total += Number(c[iTo]) || 0;
  }
  return { docs, exento, neto, iva, total };
}
function parseF29Cert(path: string) {
  try {
    const t = execFileSync("pdftotext", [path, "-"], { timeout: 30000 }).toString();
    const folio = (t.match(/Folio Declaraci[oó]n N°?:\s*(\d+)/i) || [])[1] ?? null;
    const fecha = (t.match(/presentada con fecha\s*\|?\s*(\d{2}\/\d{2}\/\d{4})/i) || t.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] ?? null;
    // los códigos aparecen listados y luego sus valores en orden
    const codes = [...t.matchAll(/C[oó]digo\s+(\d+)\s*:/g)].map((m) => m[1]);
    const nums = [...t.matchAll(/^\s*([\d.]{1,15})\s*$/gm)].map((m) => Number(m[1].replace(/\./g, ""))).filter((n) => !Number.isNaN(n));
    const meta: Record<string, unknown> = { folio, fecha };
    codes.forEach((c, i) => { if (nums[i] !== undefined) meta["c" + c] = nums[i]; });
    return meta;
  } catch { return {}; }
}

async function main() {
  const t = (await sql`select id from tenants where name='Terraplanet'`) as any[];
  const tid = t[0].id as string;
  const existing = new Set(((await sql`select title from tax_documents where tenant_id=${tid}`) as any[]).map((r) => r.title));
  const files = readdirSync(DIR).filter((f) => statSync(join(DIR, f)).isFile() && !/DS_Store/.test(f));
  let n = 0;
  for (const f of files) {
    if (existing.has(f)) continue;
    const { kind, period } = classify(f);
    const path = join(DIR, f);
    let meta: Record<string, unknown> = {};
    try {
      if (kind === "rcv_compra_resumen" || kind === "rcv_venta_resumen") meta = parseCsvResumen(path);
      else if (kind === "rcv_venta" || kind === "rcv_compra") meta = parseCsvDetalle(path);
      else if (kind === "f29_cert") meta = parseF29Cert(path);
    } catch { /* meta vacía */ }
    const bytes = readFileSync(path);
    const mime = mimeOf(f);
    const blob = await put(`sii/${tid}/${f}`, bytes, { access: "private", addRandomSuffix: true, contentType: mime });
    const bid = randomUUID();
    await sql.transaction([
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`insert into blobs (id, tenant_id, filename, mime, pathname) values (${bid}, ${tid}, ${f}, ${mime}, ${blob.pathname})`,
      sql`insert into tax_documents (tenant_id, kind, period, title, url, mime, meta)
        values (${tid}, ${kind}, ${period}, ${f}, ${"/api/files/" + bid}, ${mime}, ${JSON.stringify(meta)}::jsonb)`,
    ]);
    n++;
  }
  // meta del informe (situación SII resumida, renderizada en Contabilidad)
  const informeMeta = {
    regimen: "Pro Pyme General (14 D)",
    inicioActividades: "2024-11",
    anotaciones: "Anotación 4310 (01-07-2026): F29 no presentados Mar–Jun 2026. Riesgo de bloqueo de emisión de DTE.",
    f29Pendientes: ["2026-03", "2026-04", "2026-05", "2026-06"],
    f22: { at2025: { folio: "343792775", presentado: "08/05/2025", idpc: 147631, cpt: 4362100 }, at2026: "no presentado (sin plazo aún)" },
    bienesRaices: [
      { rol: "00857-00016", comuna: "Colina", nombre: "Las Brisas LT K 16", destino: "Habitacional", avaluo: 1260456109 },
      { rol: "00393-00072", comuna: "San Javier", nombre: "Purapel Hij 10", destino: "Agrícola", avaluo: 57629072 },
    ],
    bte: "Sin boletas de terceros 2024–2026",
  };
  await sql.transaction([
    sql`select set_config('app.current_tenant_id', ${tid}, true)`,
    sql`update tax_documents set meta = meta || ${JSON.stringify(informeMeta)}::jsonb where tenant_id=${tid} and kind='informe'`,
  ]);
  console.log(`✓ ${n} documentos SII cargados`);
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
