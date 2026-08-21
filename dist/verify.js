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
 * contract is never silent — it only happens when the caller opts in. Column-scoped
 * verify vouches for the synthetic columns; the columns a team adds are out of
 * scope here and must be checked with `scan`.
 */
import { getEntry, isReserved } from "./catalog.js";
import { sha256Hex } from "./hash.js";
import { parseCsv, canonicalColumn } from "./csv.js";
import { validateRunRecord } from "./record.js";
export async function verify(csv, record, opts) {
    const validation = validateRunRecord(record);
    if (!validation.ok) {
        return {
            ok: false,
            failures: validation.errors.map((message) => ({ kind: "invalid-record", message })),
            checked: { rows: 0, fields: 0 },
            unattestedColumns: [],
            warnings: [],
        };
    }
    const result = opts?.allowAddedColumns
        ? await verifyColumnScoped(csv, validation.record)
        : await verifyStrict(csv, validation.record);
    if (!result.failures.some((failure) => failure.kind === "malformed-csv") &&
        result.checked.rows !== validation.record.rowCount) {
        result.failures.unshift({
            kind: "invalid-record",
            message: `record rowCount ${validation.record.rowCount} does not match file row count ${result.checked.rows}`,
        });
        result.ok = false;
    }
    return result;
}
async function verifyStrict(csv, record) {
    const failures = [];
    const warnings = [];
    const actualHash = await sha256Hex(csv);
    if (actualHash !== record.contentSha256) {
        failures.push({
            kind: "content-hash-mismatch",
            message: `content hash ${actualHash} does not match recorded ${record.contentSha256}`,
        });
    }
    let parsed;
    try {
        parsed = parseCsv(csv);
    }
    catch (error) {
        failures.push({
            kind: "malformed-csv",
            message: error instanceof Error ? error.message : "the CSV is malformed",
        });
        return {
            ok: false,
            failures,
            checked: { rows: 0, fields: 0 },
            unattestedColumns: [],
            warnings,
        };
    }
    const { columns, rows } = parsed;
    const columnsMatch = columns.length === record.columns.length &&
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
async function verifyColumnScoped(csv, record) {
    const failures = [];
    const warnings = [];
    let parsed;
    try {
        parsed = parseCsv(csv);
    }
    catch (error) {
        return {
            ok: false,
            failures: [{
                    kind: "malformed-csv",
                    message: error instanceof Error ? error.message : "the CSV is malformed",
                }],
            checked: { rows: 0, fields: 0 },
            unattestedColumns: [],
            warnings,
        };
    }
    const { columns, rows } = parsed;
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
    const occurrences = new Map();
    for (const h of columns)
        occurrences.set(h, (occurrences.get(h) ?? 0) + 1);
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
        // Independent range check: an out-of-range value in a declared column fails
        // even if someone recomputes the column hash to match.
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
        // Per-column hash catches an in-range swap (one reserved value for another)
        // that the range check alone would wave through.
        const actual = await sha256Hex(canonicalColumn(values));
        if (actual !== field.sha256) {
            failures.push({
                kind: "column-hash-mismatch",
                field: field.name,
                message: `column "${field.name}" hash ${actual} does not match recorded ${field.sha256}`,
            });
        }
    }
    const unattestedColumns = columns.filter((c) => !declaredNames.has(c));
    // A blank-headed added column is surfaced (it's in unattestedColumns as ""), but a "" in
    // a long list is easy to miss — and a team told to "scan the columns you added" can't
    // easily name it. Warn so it can't be overlooked. Not a failure: added columns are scan's job.
    if (unattestedColumns.some((c) => c.trim() === "")) {
        warnings.push("an added (unattested) column has a blank header; make sure your scan covers it");
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
export function exitCode(result) {
    return result.ok ? 0 : 1;
}
//# sourceMappingURL=verify.js.map