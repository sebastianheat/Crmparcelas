/**
 * Pasada profunda de OCR para promesas sin fecha o con fecha implausible:
 * lee TODAS las páginas (hasta 14), entiende fechas escritas en palabras
 * ("veinte de marzo del dos mil veinticinco") y solo acepta fechas en el rango
 * plausible de firma [2023-06-01, hoy], priorizando las cercanas a léxico
 * notarial (otorgado/certifica/firmado/repertorio).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, readdirSync } from "node:fs";
import { get } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.REMOTE_DATABASE_URL!);
const TMP = "/tmp/claude-0/-home-user-Crmparcelas/6139210c-266f-5d06-82c6-e401923d25d3/scratchpad/ocr2";
const HOY = "2026-07-03";
const MIN = "2023-06-01";
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const DIAS: Record<string, number> = {
  "un": 1, "uno": 1, "primero": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
  "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11,
  "doce": 12, "trece": 13, "catorce": 14, "quince": 15, "dieciseis": 16,
  "diecisiete": 17, "dieciocho": 18, "diecinueve": 19, "veinte": 20,
  "veintiun": 21, "veintiuno": 21, "veintidos": 22, "veintitres": 23,
  "veinticuatro": 24, "veinticinco": 25, "veintiseis": 26, "veintisiete": 27,
  "veintiocho": 28, "veintinueve": 29, "treinta": 30, "treinta y un": 31,
  "treinta y uno": 31,
};
const ANIOS: Record<string, number> = {
  "dos mil veintitres": 2023, "dos mil veinticuatro": 2024,
  "dos mil veinticinco": 2025, "dos mil veintiseis": 2026,
};
const KEYWORDS = /(otorgad|certific|firmad|repertorio|notari|suscrit|celebra)/;

type Cand = { date: string; score: number };
function collectDates(text: string): Cand[] {
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
  const out: Cand[] = [];
  const push = (d: number, m: number, y: number, idx: number) => {
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso < MIN || iso > HOY) return;
    const ctx = t.slice(Math.max(0, idx - 160), idx + 160);
    out.push({ date: iso, score: KEYWORDS.test(ctx) ? 2 : 1 });
  };
  let m: RegExpExecArray | null;
  const reNum = /(\d{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:del?|de el)?\s*(20\d{2})/g;
  while ((m = reNum.exec(t))) push(Number(m[1]), MESES[m[2]], Number(m[3]), m.index);
  const reSlash = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})/g;
  while ((m = reSlash.exec(t))) push(Number(m[1]), Number(m[2]), Number(m[3]), m.index);
  // día en palabras + año numérico o en palabras
  const dayAlt = Object.keys(DIAS).sort((a, b) => b.length - a.length).join("|");
  const reW = new RegExp(
    `(${dayAlt})\\s*(?:dias?)?\\s*(?:del?)?\\s*(?:mes de)?\\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\\s*(?:del?|de el)?\\s*(?:año)?\\s*(20\\d{2}|dos mil veinti\\w+|dos mil \\w+)`,
    "g",
  );
  while ((m = reW.exec(t))) {
    const y = /^20\d{2}$/.test(m[3]) ? Number(m[3]) : ANIOS[m[3].trim()] ?? 0;
    if (y) push(DIAS[m[1]], MESES[m[2]], y, m.index);
  }
  return out;
}

function ocrPage(pdf: string, page: number): string {
  try {
    execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-scale-to", "1700", pdf, `${TMP}/pg`], { timeout: 60000 });
    const ppm = readdirSync(TMP).find((f) => f.startsWith("pg") && f.endsWith(".ppm"));
    if (!ppm) return "";
    execFileSync("tesseract", [`${TMP}/${ppm}`, `${TMP}/out`, "-l", "spa", "--psm", "6"], { timeout: 120000 });
    unlinkSync(`${TMP}/${ppm}`);
    return readFileSync(`${TMP}/out.txt`, "utf8");
  } catch { return ""; }
}
function pages(pdf: string): number {
  try {
    return Number((execFileSync("pdfinfo", [pdf], { timeout: 15000 }).toString().match(/Pages:\s+(\d+)/) || [])[1] || 1);
  } catch { return 1; }
}
function docxText(path: string): string {
  try {
    execFileSync("unzip", ["-o", "-q", path, "word/document.xml", "-d", TMP], { timeout: 20000 });
    return readFileSync(`${TMP}/word/document.xml`, "utf8").replace(/<[^>]+>/g, " ");
  } catch { return ""; }
}

async function main() {
  execFileSync("mkdir", ["-p", TMP]);
  const rows = (await sql`
    select distinct on (p.id) p.id as parcel_id, p.code, t.name as tenant, t.id as tid,
      p.promesa_date, b.pathname, d.title, b.mime
    from parcels p
    join tenants t on t.id = p.tenant_id
    join parcel_documents d on d.parcel_id = p.id and d.type in ('promesa','escritura')
    join blobs b on ('/api/files/' || b.id) = d.url
    where p.current_client_id is not null and b.pathname is not null
      and (p.promesa_date is null or p.promesa_date < ${MIN} or p.promesa_date > ${HOY})
    order by p.id, d.created_at desc`) as any[];
  console.log(`Docs a reprocesar (sin fecha o implausible): ${rows.length}`);
  let ok = 0;
  const fail: string[] = [];

  for (const [i, r] of rows.entries()) {
    try {
      const res = await get(r.pathname, { access: "private" });
      if (!res || res.statusCode !== 200 || !res.stream) { fail.push(`${r.code} (blob)`); continue; }
      const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
      const cands: Cand[] = [];
      if (/\.docx$/i.test(r.title)) {
        const doc = `${TMP}/doc.docx`;
        writeFileSync(doc, buf);
        cands.push(...collectDates(docxText(doc)));
      } else {
        const pdf = `${TMP}/doc.pdf`;
        writeFileSync(pdf, buf);
        try {
          const emb = execFileSync("pdftotext", [pdf, "-"], { timeout: 30000 }).toString();
          if (emb.trim().length > 200) cands.push(...collectDates(emb));
        } catch { /* escaneado */ }
        if (!cands.some((c) => c.score >= 2)) {
          const np = Math.min(pages(pdf), 14);
          for (let pg = 1; pg <= np; pg++) {
            cands.push(...collectDates(ocrPage(pdf, pg)));
            if (cands.some((c) => c.score >= 2)) break; // fecha con contexto notarial: suficiente
          }
        }
      }
      if (cands.length) {
        cands.sort((a, b) => b.score - a.score);
        const date = cands[0].date;
        await sql.transaction([
          sql`select set_config('app.current_tenant_id', ${r.tid}, true)`,
          sql`update parcels set promesa_date = ${date} where id = ${r.parcel_id}`,
        ]);
        ok++;
        console.log(`[${i + 1}/${rows.length}] ${r.tenant} ${r.code} → ${date} (score ${cands[0].score})`);
      } else {
        // fecha previa implausible sin reemplazo → anular para no ensuciar el balance
        if (r.promesa_date) {
          await sql.transaction([
            sql`select set_config('app.current_tenant_id', ${r.tid}, true)`,
            sql`update parcels set promesa_date = null where id = ${r.parcel_id}`,
          ]);
        }
        fail.push(`${r.code} · ${r.title}`);
        console.log(`[${i + 1}/${rows.length}] ${r.tenant} ${r.code} → SIN FECHA`);
      }
    } catch (e: any) {
      fail.push(`${r.code} (${e.message?.slice(0, 40)})`);
    }
  }
  console.log(`\nRESUMEN PASADA 2: ${ok}/${rows.length} resueltos · pendientes: ${fail.length}`);
  for (const f of fail) console.log("  ⚠ " + f);
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
