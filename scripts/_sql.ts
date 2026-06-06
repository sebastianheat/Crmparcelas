/**
 * Utilidades compartidas para correr SQL contra Neon sobre HTTPS.
 */

/**
 * Divide un script SQL en sentencias individuales (el driver serverless usa
 * protocolo extendido y no acepta múltiples sentencias por consulta). Respeta
 * bloques $$…$$ (cuerpos de función), strings '…' y comentarios -- y bloque.
 */
export function splitSql(raw: string): string[] {
  // Quitar los separadores de drizzle (no son SQL ejecutable).
  const input = raw.replaceAll("--> statement-breakpoint", "");
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inLine = false;
  let inBlock = false;
  let inSingle = false;
  let dollar: string | null = null;
  while (i < input.length) {
    const c = input[i];
    const two = input.slice(i, i + 2);
    if (inLine) {
      buf += c;
      if (c === "\n") inLine = false;
      i++;
    } else if (inBlock) {
      buf += c;
      if (two === "*/") {
        buf += "/";
        i += 2;
        inBlock = false;
      } else i++;
    } else if (inSingle) {
      buf += c;
      if (c === "'") inSingle = false;
      i++;
    } else if (dollar) {
      if (input.startsWith(dollar, i)) {
        buf += dollar;
        i += dollar.length;
        dollar = null;
      } else {
        buf += c;
        i++;
      }
    } else if (two === "--") {
      inLine = true;
      buf += two;
      i += 2;
    } else if (two === "/*") {
      inBlock = true;
      buf += two;
      i += 2;
    } else if (c === "'") {
      inSingle = true;
      buf += c;
      i++;
    } else {
      const m = c === "$" ? input.slice(i).match(/^\$[a-zA-Z0-9_]*\$/) : null;
      if (m) {
        dollar = m[0];
        buf += m[0];
        i += m[0].length;
      } else if (c === ";") {
        out.push(buf.trim());
        buf = "";
        i++;
      } else {
        buf += c;
        i++;
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(
    (s) =>
      s.length > 0 &&
      !s.split("\n").every((l) => l.trim().startsWith("--") || l.trim() === ""),
  );
}

/** Códigos SQLSTATE de "ya existe" → seguros de ignorar al re-aplicar. */
export const ALREADY_EXISTS = new Set([
  "42P07", // duplicate_table / relation exists
  "42710", // duplicate_object (type, policy, trigger, enum value…)
  "42701", // duplicate_column
  "42P06", // duplicate_schema
  "42723", // duplicate_function
  "42P16", // invalid_table_definition (a veces en re-alter)
  "23505", // unique_violation
]);
