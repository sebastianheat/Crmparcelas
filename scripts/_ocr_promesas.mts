/**
 * OCR masivo de promesas: extrae la fecha de firma (certificación notarial o
 * cuerpo) de cada promesa y la guarda en parcels.promesa_date.
 * Página 1 → 2 → última. Reporta cobertura al final.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, readdirSync } from "node:fs";
import { get } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.REMOTE_DATABASE_URL!);
const TMP = "/tmp/claude-0/-home-user-Crmparcelas/6139210c-266f-5d06-82c6-e401923d25d3/scratchpad/ocr";
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function findDate(text: string): string | null {
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
  // "santiago, 31 de julio de 2025" / "a 5 de marzo del 2026" / "14 de mayo de 2025"
  const re = /(\d{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:del?|de el)?\s*(20\d{2})/g;
  const found: { d: number; m: number; y: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const d = Number(m[1]), mo = MESES[m[2]], y = Number(m[3]);
    if (d >= 1 && d <= 31 && y >= 2020 && y <= 2027) found.push({ d, m: mo, y });
  }
  // dd-mm-yyyy o dd/mm/yyyy
  const re2 = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})/g;
  while ((m = re2.exec(t))) {
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2020 && y <= 2027) found.push({ d, m: mo, y });
  }
  if (!found.length) return null;
  const f = found[0];
  return `${f.y}-${String(f.m).padStart(2, "0")}-${String(f.d).padStart(2, "0")}`;
}

function ocrPage(pdf: string, page: number): string {
  try {
    execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-r", "150", pdf, `${TMP}/pg`], { timeout: 60000 });
    const ppm = readdirSync(TMP).find((f) => f.startsWith("pg") && f.endsWith(".ppm"));
    if (!ppm) return "";
    execFileSync("tesseract", [`${TMP}/${ppm}`, `${TMP}/out`, "-l", "spa", "--psm", "6"], { timeout: 120000 });
    unlinkSync(`${TMP}/${ppm}`);
    return readFileSync(`${TMP}/out.txt`, "utf8");
  } catch { return ""; }
}
function pageCount(pdf: string): number {
  try {
    const info = execFileSync("pdfinfo", [pdf], { timeout: 15000 }).toString();
    return Number((info.match(/Pages:\s+(\d+)/) || [])[1] || 1);
  } catch { return 1; }
}

async function main() {
  execFileSync("mkdir", ["-p", TMP]);
  // Una promesa por parcela vendida (la más reciente por si hay varias)
  const rows = (await sql`
    select distinct on (p.id) p.id as parcel_id, p.code, t.name as tenant, t.id as tid,
      b.pathname, d.title
    from parcels p
    join tenants t on t.id = p.tenant_id
    join parcel_documents d on d.parcel_id = p.id and d.type in ('promesa','escritura')
    join blobs b on ('/api/files/' || b.id) = d.url
    where p.current_client_id is not null and p.promesa_date is null and b.pathname is not null
    order by p.id, d.created_at desc`) as any[];
  console.log(`Promesas a procesar: ${rows.length}`);
  let ok = 0, fail: string[] = [];

  for (const [i, r] of rows.entries()) {
    try {
      const res = await get(r.pathname, { access: "private" });
      if (!res || res.statusCode !== 200 || !res.stream) { fail.push(`${r.code} (blob)`); continue; }
      const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
      const pdf = `${TMP}/doc.pdf`;
      writeFileSync(pdf, buf);
      // texto embebido primero (gratis), luego OCR pág 1, 2 y última
      let date: string | null = null;
      try {
        const emb = execFileSync("pdftotext", ["-l", "3", pdf, "-"], { timeout: 30000 }).toString();
        if (emb.trim().length > 200) date = findDate(emb);
      } catch { /* sin texto embebido */ }
      if (!date) {
        const pages = pageCount(pdf);
        for (const pg of [...new Set([1, 2, pages])]) {
          date = findDate(ocrPage(pdf, pg));
          if (date) break;
        }
      }
      if (date) {
        await sql.transaction([
          sql`select set_config('app.current_tenant_id', ${r.tid}, true)`,
          sql`update parcels set promesa_date = ${date} where id = ${r.parcel_id}`,
        ]);
        ok++;
        console.log(`[${i + 1}/${rows.length}] ${r.tenant} ${r.code} → ${date}`);
      } else {
        fail.push(`${r.code} · ${r.title}`);
        console.log(`[${i + 1}/${rows.length}] ${r.tenant} ${r.code} → SIN FECHA`);
      }
    } catch (e: any) {
      fail.push(`${r.code} (${e.message?.slice(0, 40)})`);
    }
  }
  console.log(`\nRESUMEN: ${ok}/${rows.length} con fecha · sin fecha: ${fail.length}`);
  for (const f of fail) console.log("  ⚠ " + f);
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
