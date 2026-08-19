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
export declare function generate(opts: GenerateOptions): GeneratedDataset;
//# sourceMappingURL=generate.d.ts.map