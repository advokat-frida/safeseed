import type { FieldSchema } from "./generate.js";
export type SchemaPresetId = "crm-contacts" | "marketing-attribution" | "hashed-audience" | "uk-contacts";
export interface SchemaPreset {
    id: SchemaPresetId;
    label: string;
    description: string;
    schema: readonly FieldSchema[];
}
/** Small, editable starting schemas for common sales and marketing fixture jobs. */
export declare const SCHEMA_PRESETS: readonly SchemaPreset[];
export declare function getSchemaPreset(id: string): SchemaPreset;
export declare function schemaFromPreset(id: string): FieldSchema[];
//# sourceMappingURL=presets.d.ts.map