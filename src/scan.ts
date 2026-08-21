/**
 * `scan` — reverse mode. Point it at an *existing* CSV / seed file and tell it the
 * expected type of each column; it flags every value that is NOT in the reserved
 * range as a candidate piece of real PII.
 *
 * The panel called this the thing they'd deploy first: it addresses the prod dump
 * already sitting in staging, not just freshly generated data. It is a detector of
 * candidates, not a classifier — a finding means "this is not provably safe, look
 * at it", not "this is definitely a real person".
 */
import { getEntry, isReserved } from "./catalog.js";
import { parseCsv } from "./csv.js";
import type { FieldType } from "./types.js";

export interface ScanColumn {
  name: string;
  type: FieldType;
}

export interface ScanOptions {
  csv: string;
  columns: ScanColumn[];
}

export interface ScanFinding {
  field: string;
  type: FieldType;
  row: number;
  value: string;
  reason: string;
}

export interface ScanResult {
  ok: boolean;
  findings: ScanFinding[];
  perField: Record<string, number>;
  scannedRows: number;
  /** CSV syntax errors that prevented any trustworthy row or field scan. */
  parseErrors: string[];
  /** Named columns not found in the file's header (case-insensitive, BOM/whitespace-trimmed match). */
  missingColumns: string[];
  /** Named columns matching more than one header — ambiguous, so they are not scanned. */
  duplicateColumns: string[];
  /** Zero-based data-row indexes whose cell count differs from the header width. */
  malformedRows: number[];
}

/** Header matching is case-insensitive after stripping a leading BOM and surrounding whitespace. */
const normalizeHeader = (name: string): string => name.replace(/^\uFEFF/, "").trim().toLowerCase();

export function scan(opts: ScanOptions): ScanResult {
  const findings: ScanFinding[] = [];
  const perField: Record<string, number> = {};
  for (const col of opts.columns) perField[col.name] = 0;

  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(opts.csv);
  } catch (error) {
    return {
      ok: false,
      findings,
      perField,
      scannedRows: 0,
      parseErrors: [error instanceof Error ? error.message : "malformed CSV"],
      missingColumns: [],
      duplicateColumns: [],
      malformedRows: [],
    };
  }
  const { columns: dataColumns, rows } = parsed;

  // A named column that silently doesn't get scanned is a false clean, so unmatched
  // names are reported: zero header matches -> missing, two or more -> ambiguous.
  const indicesByHeader = new Map<string, number[]>();
  dataColumns.forEach((name, i) => {
    const key = normalizeHeader(name);
    const list = indicesByHeader.get(key);
    if (list) list.push(i);
    else indicesByHeader.set(key, [i]);
  });

  const missingColumns: string[] = [];
  const duplicateColumns: string[] = [];
  const malformedRows: number[] = [];
  const indexByName = new Map<string, number>();
  for (const col of opts.columns) {
    const matches = indicesByHeader.get(normalizeHeader(col.name)) ?? [];
    if (matches.length === 0) missingColumns.push(col.name);
    else if (matches.length > 1) duplicateColumns.push(col.name);
    else indexByName.set(col.name, matches[0]!);
  }

  rows.forEach((row, r) => {
    if (row.length !== dataColumns.length) malformedRows.push(r);
    for (const col of opts.columns) {
      const idx = indexByName.get(col.name);
      if (idx === undefined) continue;
      const value = row[idx];
      if (value === undefined || value === "") continue;
      const entry = getEntry(col.type);
      if (!isReserved(entry, value)) {
        findings.push({
          field: col.name,
          type: col.type,
          row: r,
          value,
          reason: `not in reserved range for ${col.type}`,
        });
        perField[col.name] = (perField[col.name] ?? 0) + 1;
      }
    }
  });

  return {
    ok:
      findings.length === 0 &&
      missingColumns.length === 0 &&
      duplicateColumns.length === 0 &&
      malformedRows.length === 0,
    findings,
    perField,
    scannedRows: rows.length,
    parseErrors: [],
    missingColumns,
    duplicateColumns,
    malformedRows,
  };
}
