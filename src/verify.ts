/**
 * `verify` — the enforcement gate. Given a file and its run record, it:
 *   1. re-hashes the file and compares to the recorded content hash (tamper-evidence), and
 *   2. independently re-checks every value against its declared reserved range.
 *
 * Both checks run and all failures are reported. The range check is independent of
 * the hash on purpose: even if someone edits the file *and* recomputes the hash,
 * an out-of-range (candidate real) value still fails. Wire `exitCode` into CI to
 * fail the build on any drift.
 *
 * Strict whole-file verify is the DEFAULT. Pass `{ allowAddedColumns: true }` for
 * column-scoped verify: it attests only the declared synthetic columns (matched by
 * header name, order-independent) via per-column hash + range, and REPORTS added
 * business columns as unattested rather than failing on them. The relaxed
 * guarantee is never silent — it only happens when the caller opts in. Column-scoped
 * verify vouches for the synthetic columns; the columns a team adds are out of
 * scope here and must be checked with `scan`.
 */
import { CATALOG_VERSION, getEntry, isReserved } from "./catalog.js";
import { sha256Hex } from "./hash.js";
import { parseCsv, canonicalColumn } from "./csv.js";
import type { RunRecord } from "./record.js";

/**
 * When a record was made under a different catalog, the reserved ranges it was
 * generated against may not be the ranges enforced now — most notably catalog
 * 2.0.0 removed SSN areas 900-999 (the IRS ITIN space, which contains real
 * identifiers), so ssn values from catalog-1.0.0 records fail the range check BY
 * DESIGN. There is deliberately no compatibility mode that re-blesses an old
 * range; this warning exists so the failure is explained, not mysterious.
 */
function catalogVersionWarning(record: RunRecord): string | null {
  if (record.catalogVersion === undefined || record.catalogVersion === CATALOG_VERSION) return null;
  return (
    `run record was made under catalog ${record.catalogVersion}; this SafeSeed enforces catalog ${CATALOG_VERSION}. ` +
    `Reserved ranges have changed between catalog versions (2.0.0 removed SSN areas 900-999 — the IRS ITIN space, ` +
    `which holds real identifiers), so any out-of-range failures reported may reflect the corrected ranges rather than ` +
    `tampering. Regenerate the dataset and record with the current version.`
  );
}

export type VerifyFailureKind =
  | "content-hash-mismatch"
  | "out-of-range-value"
  | "schema-mismatch"
  | "row-arity-mismatch"
  | "missing-column"
  | "column-hash-mismatch";

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
  /** Columns present in the file but not declared in the record (column-scoped mode). */
  unattestedColumns: string[];
  /**
   * Non-fatal notes, e.g. a 0.1.0 record with no per-column hash → range-only
   * fallback, or a record made under an older catalog whose reserved ranges have
   * since changed (in which case range failures are expected and by design).
   */
  warnings: string[];
}

export interface VerifyOptions {
  /**
   * Opt-in column-scoped mode. Attest only the declared synthetic columns (by name)
   * and report — rather than fail on — columns the team added. Off by default, so
   * the strict whole-file guarantee is the one you get unless you ask otherwise.
   */
  allowAddedColumns?: boolean;
}

export async function verify(
  csv: string,
  record: RunRecord,
  opts?: VerifyOptions,
): Promise<VerifyResult> {
  return opts?.allowAddedColumns ? verifyColumnScoped(csv, record) : verifyStrict(csv, record);
}

async function verifyStrict(csv: string, record: RunRecord): Promise<VerifyResult> {
  const failures: VerifyFailure[] = [];
  const warnings: string[] = [];

  const versionWarning = catalogVersionWarning(record);
  if (versionWarning !== null) warnings.push(versionWarning);

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
    // The verifier must be authoritative over the WHOLE row, not just the declared
    // columns — otherwise a tampered file could append a trailing column of real PII
    // (and recompute the hash) and pass. Any arity mismatch is a failure.
    if (row.length !== record.fields.length) {
      failures.push({
        kind: "row-arity-mismatch",
        row: r,
        message: `row ${r}: expected ${record.fields.length} columns, found ${row.length}`,
      });
    }
    record.fields.forEach((field, c) => {
      const value = row[c];
      if (value === undefined) {
        failures.push({
          kind: "out-of-range-value",
          field: field.name,
          row: r,
          message: `${field.name} row ${r}: missing value`,
        });
        return;
      }
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
    unattestedColumns: [],
    warnings,
  };
}

async function verifyColumnScoped(csv: string, record: RunRecord): Promise<VerifyResult> {
  const failures: VerifyFailure[] = [];
  const warnings: string[] = [];

  const versionWarning = catalogVersionWarning(record);
  if (versionWarning !== null) warnings.push(versionWarning);

  const { columns, rows } = parseCsv(csv);

  // The file must stay rectangular: every row matches the header width. This closes
  // the same hole strict mode closes — a trailing unheadered cell can't smuggle in
  // real PII, because it would make a row wider than the header and fail here.
  rows.forEach((row, r) => {
    if (row.length !== columns.length) {
      failures.push({
        kind: "row-arity-mismatch",
        row: r,
        message: `row ${r}: expected ${columns.length} columns, found ${row.length}`,
      });
    }
  });

  // Count header occurrences so a duplicated declared name is caught as ambiguous
  // rather than silently resolving to the first match.
  const occurrences = new Map<string, number>();
  for (const h of columns) occurrences.set(h, (occurrences.get(h) ?? 0) + 1);

  const declaredNames = new Set(record.fields.map((f) => f.name));

  for (const field of record.fields) {
    const count = occurrences.get(field.name) ?? 0;
    if (count === 0) {
      failures.push({
        kind: "missing-column",
        field: field.name,
        message: `declared column "${field.name}" is missing from the file`,
      });
      continue;
    }
    if (count > 1) {
      failures.push({
        kind: "schema-mismatch",
        field: field.name,
        message: `declared column "${field.name}" is ambiguous: it appears ${count} times`,
      });
      continue;
    }

    const idx = columns.indexOf(field.name);
    const values = rows.map((row) => row[idx] ?? "");
    const entry = getEntry(field.type);

    // Independent range check: a real value smuggled into a synthetic column fails
    // even if an attacker recomputes the column hash to match.
    values.forEach((value, r) => {
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

    // Per-column hash: catches an in-range swap (one reserved value for another)
    // that the range check alone would wave through. Falls back to range-only with a
    // warning for 0.1.0 records that predate per-column hashes.
    if (field.sha256 === undefined) {
      warnings.push(
        `column "${field.name}": run record predates per-column hashes; verified by range only`,
      );
    } else {
      const actual = await sha256Hex(canonicalColumn(values));
      if (actual !== field.sha256) {
        failures.push({
          kind: "column-hash-mismatch",
          field: field.name,
          message: `column "${field.name}" hash ${actual} does not match recorded ${field.sha256}`,
        });
      }
    }
  }

  const unattestedColumns = columns.filter((c) => !declaredNames.has(c));

  // A blank-headed added column is surfaced (it's in unattestedColumns as ""), but a "" in
  // a long list is easy to miss — and a team told to "scan the columns you added" can't
  // easily name it. Warn so it can't be overlooked. Not a failure: added columns are scan's job.
  if (unattestedColumns.some((c) => c.trim() === "")) {
    warnings.push(
      "an added (unattested) column has a blank header; make sure your scan covers it",
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    checked: { rows: rows.length, fields: record.fields.length },
    unattestedColumns,
    warnings,
  };
}

/** CI helper: 0 when clean, 1 on any drift. */
export function exitCode(result: VerifyResult): number {
  return result.ok ? 0 : 1;
}
