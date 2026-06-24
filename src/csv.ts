/**
 * Minimal, correct CSV (RFC 4180-ish) serializer and parser. Kept in-house so the
 * core has no runtime dependency to audit — the whole pitch is "audit a few
 * hundred cited lines once, trust every output."
 */

/** Serialize columns + rows to a CSV string with a trailing newline. */
export function toCsv(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  const escape = (v: string): string =>
    /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const header = columns.map(escape).join(",");
  if (rows.length === 0) return `${header}\n`;
  const body = rows.map((r) => r.map(escape).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

/** Parse a CSV string into header columns and data rows. */
export function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let started = false; // have we seen any content for the current record/field?

  const pushField = (): void => {
    record.push(field);
    field = "";
  };
  const pushRecord = (): void => {
    pushField();
    records.push(record);
    record = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      started = true;
    } else if (c === ",") {
      pushField();
      started = true;
    } else if (c === "\n") {
      pushRecord();
    } else if (c === "\r") {
      // swallow; newline handled on \n
    } else {
      field += c;
      started = true;
    }
  }
  // Flush a final record only if the file did not end on a clean record break.
  if (started || field.length > 0 || record.length > 0) {
    pushRecord();
  }

  const columns = records.shift() ?? [];
  return { columns, rows: records };
}
