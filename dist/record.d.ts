import { type GeneratedDataset } from "./generate.js";
import type { FieldType, Tier } from "./types.js";
export declare const SAFESEED_VERSION = "0.4.0";
export interface FieldRecord {
    name: string;
    type: FieldType;
    tier: Tier;
    citation: string;
    claim: string;
    /** Present when the output is transformed from a catalog-constrained input. */
    derivation?: string;
    /**
     * SHA-256 over a canonical serialization of this column's values (see
     * `canonicalColumn`). Lets column-scoped verify re-check one declared column
     * independently of the rest of the file. Required by the 0.3.0 record contract.
     */
    sha256: string;
}
export interface RunRecord {
    safeseedVersion: string;
    catalogVersion: string;
    seed: number;
    rowCount: number;
    columns: string[];
    fields: FieldRecord[];
    /** SHA-256 of the exact emitted file content. */
    contentSha256: string;
    /** Honest statement of what this record declares and what it does NOT establish. */
    attestation: string;
    /** Optional caller-supplied timestamp; omitted by default to keep records deterministic. */
    generatedAt?: string;
}
export type RunRecordValidation = {
    ok: true;
    record: RunRecord;
} | {
    ok: false;
    errors: string[];
};
export declare const ATTESTATION: string;
/**
 * Runtime validation for JSON records crossing the CLI/browser boundary. TypeScript
 * types disappear at runtime, so verification must fail closed rather than trust a
 * cast object or throw while dereferencing malformed attacker-controlled metadata.
 */
export declare function validateRunRecord(value: unknown): RunRecordValidation;
export declare function makeRunRecord(dataset: GeneratedDataset, csv: string, opts?: {
    generatedAt?: string;
}): Promise<RunRecord>;
//# sourceMappingURL=record.d.ts.map