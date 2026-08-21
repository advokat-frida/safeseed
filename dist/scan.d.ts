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
export declare function scan(opts: ScanOptions): ScanResult;
//# sourceMappingURL=scan.d.ts.map