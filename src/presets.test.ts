import { describe, expect, it } from "vitest";
import { CATALOG, getEntry, isReserved } from "./catalog.js";
import { generate } from "./generate.js";
import { SCHEMA_PRESETS, getSchemaPreset, schemaFromPreset } from "./presets.js";

describe("presets.arePracticalInspectableSchemas", () => {
  it("has four unique, named presets with unique columns and known field types", () => {
    expect(SCHEMA_PRESETS.map((preset) => preset.id)).toEqual([
      "crm-contacts",
      "marketing-attribution",
      "hashed-audience",
      "uk-contacts",
    ]);
    const known = new Set(CATALOG.map((entry) => entry.field));
    for (const preset of SCHEMA_PRESETS) {
      expect(preset.label.trim().length, preset.id).toBeGreaterThan(0);
      expect(preset.description.trim().length, preset.id).toBeGreaterThan(0);
      const names = preset.schema.map((field) => field.name);
      expect(new Set(names).size, preset.id).toBe(names.length);
      for (const field of preset.schema) expect(known.has(field.type), `${preset.id}:${field.type}`).toBe(true);
    }
  });

  it("every preset generates values accepted by the current catalog", () => {
    for (const preset of SCHEMA_PRESETS) {
      const ds = generate({ schema: schemaFromPreset(preset.id), rows: 25, seed: 42 });
      ds.rows.forEach((row) => row.forEach((value, index) => {
        const field = preset.schema[index]!;
        expect(isReserved(getEntry(field.type), value), `${preset.id}:${field.name}=${value}`).toBe(true);
      }));
    }
  });

  it("keeps both hashed match-key columns unique across the default 100-row job", () => {
    const schema = schemaFromPreset("hashed-audience");
    const ds = generate({ schema, rows: 100, seed: 42 });
    for (const type of ["sha256Email", "sha256Phone"] as const) {
      const index = schema.findIndex((field) => field.type === type);
      const values = ds.rows.map((row) => row[index]!);
      expect(new Set(values).size, type).toBe(100);
    }
  });

  it("returns editable schema copies instead of mutating the preset registry", () => {
    const schema = schemaFromPreset("crm-contacts");
    schema[0]!.name = "changed";
    expect(getSchemaPreset("crm-contacts").schema[0]!.name).toBe("contact_id");
  });

  it("rejects unknown preset IDs with the available IDs in the message", () => {
    expect(() => getSchemaPreset("mystery")).toThrow(/crm-contacts.*marketing-attribution/i);
  });
});
