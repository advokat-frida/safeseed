/**
 * Minimal, correct CSV (RFC 4180-ish) serializer and parser. Kept in-house so the
 * core has no runtime dependency to audit. Review the small versioned catalog,
 * then verify each artifact against the current contract.
 */
/** Serialize columns + rows to a CSV string with a trailing newline. */
export declare function toCsv(columns: readonly string[], rows: readonly (readonly string[])[]): string;
/**
 * Canonical serialization of one column's cell values, used for the per-column
 * hash in a run record. JSON encoding is unambiguous — a comma, quote, or newline
 * inside a cell can't collide with the delimiter — so two columns hash equal iff
 * their ordered values are identical. Generation and column-scoped verify both go
 * through this one function, so they can never disagree on what a column "is".
 */
export declare function canonicalColumn(values: readonly string[]): string;
/** Parse a CSV string into header columns and data rows. */
export declare function parseCsv(text: string): {
    columns: string[];
    rows: string[][];
};
//# sourceMappingURL=csv.d.ts.map