/**
 * Crea el proyecto "Casa Brisas" (Terraplanet/Metacon): compra abr-2025 y
 * venta abr-2026 a Eduardo Vargas con facturas exenta+afecta. Sube los 57
 * documentos de respaldo, registra costo de compra y los ingresos de venta.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";

const BASE = "/tmp/claude-0/-home-user-Crmparcelas/6139210c-266f-5d06-82c6-e401923d25d3/scratchpad/brisas/casa brisas/BRISAS DE CHICUREO";
const sql = neon(process.env.REMOTE_DATABASE_URL!);
const mimeOf = (f: string) => {
  const e = f.toLowerCase().split(".").pop();
  return e === "pdf" ? "application/pdf" : e === "jpg" || e === "jpeg" ? "image/jpeg"
    : e === "png" ? "image/png"
    : e === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/octet-stream";
};
function ptype(name: string): string {
  const n = name.toUpperCase();
  if (/COMPRAVENTA|ESCRITURA/.test(n)) return "compraventa";
  if (/INSCRIPCION|INSCRIPCIÓN|SUBINSCRIPCION|VIGENCIA CBR|GP Y/.test(n)) return "inscripcion_cbr";
  if (/PLANO|SCAN_/.test(n)) return "plano";
  if (/TITULOS|TÍTULOS|DECLARACI/.test(n)) return "estudio_titulos";
  return "otro";
}

async function main() {
  const t = (await sql`select id from tenants where name='Terraplanet'`) as any[];
  const tid = t[0].id as string;

  // 1) Proyecto
  let proj = ((await sql`select id from projects where tenant_id=${tid} and slug='casa-brisas'`) as any[])[0];
  if (!proj) {
    const pid = randomUUID();
    await sql.transaction([
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`insert into projects (id, tenant_id, name, slug, comuna, region, status, description, price_from, price_unit)
        values (${pid}, ${tid}, ${"Casa Brisas"}, ${"casa-brisas"}, ${"Colina"}, ${"Metropolitana"}, ${"vendido_100"},
        ${"Casa en Las Brisas de Chicureo, Lote K-16 (La Vendimia 1090), rol 00857-00016 Colina. Comprada por Metacon Spa el 21-04-2025 en 12.500 UF ($487.712.250, Rep. 24014-2025) y vendida a Eduardo Andrés Vargas Tapia en abril 2026 por $1.157.327.650 (factura exenta N°2 terreno $405.942.650 + factura afecta N°6 $751.385.000 con crédito hipotecario; hipoteca inscrita). Cadena de títulos completa en documentos."},
        ${1157327650}, ${"clp"})`,
    ]);
    proj = { id: pid };
    console.log("✓ proyecto Casa Brisas creado");
  } else console.log("= proyecto ya existía");

  // 2) Cliente comprador + parcela K-16 vendida
  let cli = ((await sql`select id from clients where tenant_id=${tid} and rut='10.605.915-2'`) as any[])[0];
  if (!cli) {
    const cid = randomUUID();
    await sql.transaction([
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`insert into clients (id, tenant_id, name, rut, direccion) values (${cid}, ${tid}, ${"EDUARDO ANDRES VARGAS TAPIA"}, ${"10.605.915-2"}, ${"Vicuña Mackenna 7566, Renca, Santiago"})`,
    ]);
    cli = { id: cid };
    console.log("✓ cliente Eduardo Vargas creado");
  }
  let parcel = ((await sql`select id from parcels where project_id=${proj.id} and code='K-16'`) as any[])[0];
  if (!parcel) {
    const paid = randomUUID();
    await sql.transaction([
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`insert into parcels (id, tenant_id, project_id, code, price, price_unit, status, current_client_id, promesa_date)
        values (${paid}, ${tid}, ${proj.id}, ${"K-16"}, ${1157327650}, ${"clp"}, ${"escriturada"}, ${cli.id}, ${"2026-04-14"})`,
    ]);
    parcel = { id: paid };
    console.log("✓ parcela K-16 creada (escriturada, cliente Vargas)");
  }

  // 3) Documentos: todo el árbol → project_documents; carpeta de venta y
  //    facturas → además parcela/cliente
  const existingP = new Set(((await sql`select title from project_documents where project_id=${proj.id}`) as any[]).map((r) => r.title));
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const full = join(dir, f);
      if (/DS_Store|__MACOSX/.test(f)) return [];
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  let up = 0;
  for (const full of walk(BASE)) {
    const name = full.split("/").pop()!;
    if (existingP.has(name)) continue;
    const bytes = readFileSync(full);
    const mime = mimeOf(name);
    const blob = await put(`proyectos/${proj.id}/${name}`, bytes, { access: "private", addRandomSuffix: true, contentType: mime });
    const bid = randomUUID();
    const url = "/api/files/" + bid;
    const isVenta = /venta metacon a vargas/i.test(full) || /FE2/.test(name);
    const stmts: any[] = [
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`insert into blobs (id, tenant_id, filename, mime, pathname) values (${bid}, ${tid}, ${name}, ${mime}, ${blob.pathname})`,
      sql`insert into project_documents (tenant_id, project_id, type, title, url, mime) values (${tid}, ${proj.id}, ${ptype(name)}::project_doc_type, ${name}, ${url}, ${mime})`,
    ];
    if (isVenta) {
      const kind = /FE2|FACTURA/i.test(name) ? "comprobante" : /PROMESA/i.test(name) ? "promesa" : /COMPRAVENTA|CESION/i.test(name) ? "escritura" : "otro";
      stmts.push(sql`insert into parcel_documents (tenant_id, parcel_id, project_id, type, title, url, status) values (${tid}, ${parcel.id}, ${proj.id}, ${kind}::parcel_doc_type, ${name}, ${url}, ${"firmado"})`);
      stmts.push(sql`insert into client_documents (tenant_id, client_id, type, title, url, mime) values (${tid}, ${cli.id}, ${kind === "comprobante" ? "comprobante_pago" : kind}, ${name}, ${url}, ${mime})`);
    }
    await sql.transaction(stmts);
    up++;
  }
  console.log(`✓ ${up} documentos subidos`);

  // 4) Costo de compra
  const dupC = (await sql`select 1 from costs where tenant_id=${tid} and description like 'Compra Casa Brisas%'`) as any[];
  if (!dupC.length) {
    await sql.transaction([
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`insert into costs (tenant_id, project_id, category, amount_clp, description, incurred_at)
        values (${tid}, ${proj.id}, ${"terreno"}::cost_category, ${487712250},
        ${"Compra Casa Brisas (Lote K-16, Las Brisas de Chicureo) — 12.500 UF (UF $39.016,98 al 21-04-2025) · Escritura 21-04-2025, Rep. 24014-2025 · Vendedor: Sebastián Yáñez"}, ${"2025-04-21"})`,
    ]);
    console.log("✓ costo compra registrado: $487.712.250");
  }

  // 5) Ingresos de la venta (comprobantes de dinero)
  const dupV = (await sql`select 1 from money_vouchers where tenant_id=${tid} and concept like 'Venta Casa Brisas%'`) as any[];
  if (!dupV.length) {
    const [{ value: lastFolio }] = (await sql`select coalesce(max(folio),0)::int as value from money_vouchers where tenant_id=${tid}`) as any[];
    await sql.transaction([
      sql`select set_config('app.current_tenant_id', ${tid}, true)`,
      sql`insert into money_vouchers (tenant_id, project_id, parcel_id, client_id, folio, concept, amount_clp, status, issued_at)
        values (${tid}, ${proj.id}, ${parcel.id}, ${cli.id}, ${lastFolio + 1},
        ${"Venta Casa Brisas — Factura exenta N°2 (terreno Lote K-16), 14-04-2026"}, ${405942650}, ${"validado"}, ${"2026-04-14"})`,
      sql`insert into money_vouchers (tenant_id, project_id, parcel_id, client_id, folio, concept, amount_clp, status, issued_at)
        values (${tid}, ${proj.id}, ${parcel.id}, ${cli.id}, ${lastFolio + 2},
        ${"Venta Casa Brisas — Factura afecta N°6 (neto $631.415.966 + IVA $119.969.034), 15-04-2026"}, ${751385000}, ${"validado"}, ${"2026-04-15"})`,
    ]);
    console.log("✓ ingresos registrados: $405.942.650 (exenta) + $751.385.000 (afecta)");
  }
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
