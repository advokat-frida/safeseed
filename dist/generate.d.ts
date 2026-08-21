import type { FieldType } from "./types.js";
export interface FieldSchema {
    /** Output column name. */
    name: string;
    /** Catalog field type that governs the reserved range. */
    type: FieldType;
}
export interface GenerateOptions {
    schema: FieldSchema[];
    rows: number;
    /** Seed for deterministic output. Same seed + schema => identical dataset. */
    seed: number;
    /**
     * Format-valid mode (default true): render values in the common wire shape while
     * staying in range (10-digit phones, NNN-NN-NNNN SSNs). "Format-valid" means the
     * SHAPE passes — a strict validator that encodes issuance rules (e.g. an SSN
     * checker that rejects group 00 / serial 0000) will still reject the value, and
     * that is by design: never-issued is the safety property. When false, values are
     * rendered in a looser, even-more-obviously-test form.
     */
    formatValid?: boolean;
}
export interface GeneratedDataset {
    columns: string[];
    rows: string[][];
    schema: FieldSchema[];
    seed: number;
    catalogVersion: string;
}
export declare const MAX_GENERATE_ROWS = 100000;
export declare const MAX_GENERATE_SEED = 4294967295;
export declare const MAX_SCHEMA_FIELDS = 256;
export declare const MAX_COLUMN_NAME_LENGTH = 256;
/**
 * SafeSeed writes schema names into the first CSV row. Keep that caller-controlled
 * surface single-line and prevent common spreadsheet formula prefixes, including
 * when hidden behind leading whitespace. CSV quoting alone does not neutralize a
 * spreadsheet formula.
 */
export declare function isSafeColumnName(name: unknown): name is string;
export declare function generate(opts: GenerateOptions): GeneratedDataset;
//# sourceMappingURL=generate.d.ts.map