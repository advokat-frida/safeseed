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
}

export function scan(opts: ScanOptions): ScanResult {
  const { columns: dataColumns, rows } = parseCsv(opts.csv);
  const findings: ScanFinding[] = [];
  const perField: Record<string, number> = {};
  for (const col of opts.columns) perField[col.name] = 0;

  const indexByName = new Map<string, number>();
  dataColumns.forEach((name, i) => indexByName.set(name, i));

  rows.forEach((row, r) => {
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
    ok: findings.length === 0,
    findings,
    perField,
    scannedRows: rows.length,
  };
}
