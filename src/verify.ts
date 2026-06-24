/**
 * `verify` — the enforcement gate. Given a file and its run record, it:
 *   1. re-hashes the file and compares to the recorded content hash (tamper-evidence), and
 *   2. independently re-checks every value against its declared reserved range.
 *
 * Both checks run and all failures are reported. The range check is independent of
 * the hash on purpose: even if someone edits the file *and* recomputes the hash,
 * an out-of-range (candidate real) value still fails. Wire `exitCode` into CI to
 * fail the build on any drift.
 */
import { getEntry, isReserved } from "./catalog.js";
import { sha256Hex } from "./hash.js";
import { parseCsv } from "./csv.js";
import type { RunRecord } from "./record.js";

export type VerifyFailureKind =
  | "content-hash-mismatch"
  | "out-of-range-value"
  | "schema-mismatch";

export interface VerifyFailure {
  kind: VerifyFailureKind;
  message: string;
  field?: string;
  row?: number;
  value?: string;
}

export interface VerifyResult {
  ok: boolean;
  failures: VerifyFailure[];
  checked: { rows: number; fields: number };
}

export async function verify(csv: string, record: RunRecord): Promise<VerifyResult> {
  const failures: VerifyFailure[] = [];

  const actualHash = await sha256Hex(csv);
  if (actualHash !== record.contentSha256) {
    failures.push({
      kind: "content-hash-mismatch",
      message: `content hash ${actualHash} does not match recorded ${record.contentSha256}`,
    });
  }

  const { columns, rows } = parseCsv(csv);

  const columnsMatch =
    columns.length === record.columns.length &&
    columns.every((c, i) => c === record.columns[i]);
  if (!columnsMatch) {
    failures.push({
      kind: "schema-mismatch",
      message: `columns ${JSON.stringify(columns)} do not match recorded ${JSON.stringify(record.columns)}`,
    });
  }

  rows.forEach((row, r) => {
    record.fields.forEach((field, c) => {
      const value = row[c];
      if (value === undefined) return;
      const entry = getEntry(field.type);
      if (!isReserved(entry, value)) {
        failures.push({
          kind: "out-of-range-value",
          field: field.name,
          row: r,
          value,
          message: `${field.name} row ${r}: "${value}" is not in the reserved range for ${field.type}`,
        });
      }
    });
  });

  return {
    ok: failures.length === 0,
    failures,
    checked: { rows: rows.length, fields: record.fields.length },
  };
}

/** CI helper: 0 when clean, 1 on any drift. */
export function exitCode(result: VerifyResult): number {
  return result.ok ? 0 : 1;
}
