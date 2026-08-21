import { type RunRecord } from "./record.js";
export type VerifyFailureKind = "invalid-record" | "malformed-csv" | "content-hash-mismatch" | "out-of-range-value" | "schema-mismatch" | "row-arity-mismatch" | "missing-column" | "column-hash-mismatch";
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
    checked: {
        rows: number;
        fields: number;
    };
    /** Columns present in the file but not declared in the record (column-scoped mode). */
    unattestedColumns: string[];
    /**
     * Non-fatal notes about the checked file, such as a blank-headed added column
     * that needs explicit scanning in column-scoped mode.
     */
    warnings: string[];
}
export interface VerifyOptions {
    /**
     * Opt-in column-scoped mode. Attest only the declared synthetic columns (by name)
     * and report — rather than fail on — columns the team added. Off by default, so
     * the strict whole-file contract is the one you get unless you ask otherwise.
     */
    allowAddedColumns?: boolean;
}
export declare function verify(csv: string, record: RunRecord, opts?: VerifyOptions): Promise<VerifyResult>;
/** CI helper: 0 when clean, 1 on any drift. */
export declare function exitCode(result: VerifyResult): number;
//# sourceMappingURL=verify.d.ts.map