import { describe, it, expect } from "vitest";
import {
  generate,
  MAX_COLUMN_NAME_LENGTH,
  MAX_SCHEMA_FIELDS,
  type FieldSchema,
} from "./generate.js";
import { getEntry, isReserved, isSelfEvidentlyFake } from "./catalog.js";
import { luhnValid } from "./luhn.js";

const FULL_SCHEMA: FieldSchema[] = [
  { name: "email", type: "email" },
  { name: "email_sha256", type: "sha256Email" },
  { name: "domain", type: "domain" },
  { name: "ip", type: "ipv4" },
  { name: "ip6", type: "ipv6" },
  { name: "phone", type: "phone" },
  { name: "phone_uk", type: "ukPhone" },
  { name: "phone_sha256", type: "sha256Phone" },
  { name: "ssn", type: "ssn" },
  { name: "card", type: "creditCard" },
  { name: "landing_page_url", type: "marketingUrl" },
  { name: "cookie_id", type: "opaqueId" },
  { name: "first", type: "firstName" },
  { name: "last", type: "lastName" },
  { name: "full", type: "fullName" },
  { name: "addr", type: "streetAddress" },
  { name: "note", type: "freeText" },
];

describe("generate.deterministicForSeed", () => {
  it("same seed yields byte-identical output", () => {
    const a = generate({ schema: FULL_SCHEMA, rows: 50, seed: 12345 });
    const b = generate({ schema: FULL_SCHEMA, rows: 50, seed: 12345 });
    expect(b).toEqual(a);
  });

  it("different seeds diverge", () => {
    const a = generate({ schema: FULL_SCHEMA, rows: 50, seed: 1 });
    const b = generate({ schema: FULL_SCHEMA, rows: 50, seed: 2 });
    expect(b.rows).not.toEqual(a.rows);
  });
});

describe("generate.everyPiiValueInDeclaredReservedRange", () => {
  it("every generated value is within its field's reserved range", () => {
    const ds = generate({ schema: FULL_SCHEMA, rows: 250, seed: 99 });
    ds.rows.forEach((row) => {
      row.forEach((value, c) => {
        const entry = getEntry(FULL_SCHEMA[c]!.type);
        expect(isReserved(entry, value), `${FULL_SCHEMA[c]!.type}="${value}"`).toBe(true);
      });
    });
  });

  it("holds in both format-valid and obvious mode", () => {
    for (const formatValid of [true, false]) {
      const ds = generate({ schema: FULL_SCHEMA, rows: 100, seed: 4, formatValid });
      ds.rows.forEach((row) => {
        row.forEach((value, c) => {
          const entry = getEntry(FULL_SCHEMA[c]!.type);
          expect(isReserved(entry, value), `${formatValid}:${FULL_SCHEMA[c]!.type}="${value}"`).toBe(true);
        });
      });
    }
  });
});

describe("generate.formatValidModePassesCommonValidators", () => {
  const ds = generate({ schema: FULL_SCHEMA, rows: 100, seed: 7, formatValid: true });
  const colValues = (type: FieldSchema["type"]): string[] => {
    const idx = FULL_SCHEMA.findIndex((f) => f.type === type);
    return ds.rows.map((r) => r[idx]!);
  };

  it("emails pass a common email regex", () => {
    const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    for (const v of colValues("email")) expect(re.test(v), v).toBe(true);
  });

  it("test cards pass Luhn", () => {
    for (const v of colValues("creditCard")) expect(luhnValid(v.replace(/\D/g, "")), v).toBe(true);
  });

  it("ssns are syntactically NNN-NN-NNNN", () => {
    for (const v of colValues("ssn")) expect(/^\d{3}-\d{2}-\d{4}$/.test(v), v).toBe(true);
  });

  it("phones in format-valid mode carry a full 10 digits", () => {
    for (const v of colValues("phone")) expect(v.replace(/\D/g, "").length, v).toBe(10);
  });

  it("UK phones use the E.164 wire shape", () => {
    for (const v of colValues("ukPhone")) expect(/^\+447700900\d{3}$/.test(v), v).toBe(true);
  });

  it("hashed match keys are lowercase SHA-256 hex and remain in their allowlists", () => {
    for (const type of ["sha256Email", "sha256Phone"] as const) {
      for (const v of colValues(type)) {
        expect(/^[0-9a-f]{64}$/.test(v), v).toBe(true);
        expect(isReserved(getEntry(type), v), v).toBe(true);
      }
    }
  });

  it("marketing URLs are ordinary HTTPS URLs on the reserved campaign host", () => {
    for (const v of colValues("marketingUrl")) {
      const parsed = new URL(v);
      expect(parsed.protocol).toBe("https:");
      expect(parsed.hostname).toBe("campaign.example.com");
      expect(parsed.searchParams.get("utm_campaign")).toMatch(/^TEST_CAMPAIGN_\d{6,}$/);
    }
  });

  it("opaque IDs are cookie-safe obvious TEST tokens named for their column", () => {
    for (const v of colValues("opaqueId")) {
      expect(v).toMatch(/^TEST_COOKIE_ID_\d{6,}$/);
      expect(/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/.test(v), v).toBe(true);
    }
  });
});

describe("generate.structurallyFakeFieldsAreSelfEvidentlyFake", () => {
  it("name, address, and free-text fields read as obvious test data", () => {
    const ds = generate({
      schema: [
        { name: "first", type: "firstName" },
        { name: "last", type: "lastName" },
        { name: "full", type: "fullName" },
        { name: "addr", type: "streetAddress" },
        { name: "note", type: "freeText" },
        { name: "cookie_id", type: "opaqueId" },
        { name: "landing_page_url", type: "marketingUrl" },
      ],
      rows: 25,
      seed: 3,
    });
    ds.rows.flat().forEach((v) => expect(isSelfEvidentlyFake(v), v).toBe(true));
  });
});

describe("generate.staysInRangeAtScale", () => {
  it("ipv6 and structurally-fake tokens stay in range past the single-hextet (65,535) boundary", () => {
    const ds = generate({
      schema: [
        { name: "ip6", type: "ipv6" },
        { name: "last", type: "lastName" },
      ],
      rows: 70000,
      seed: 1,
    });
    const ip6 = getEntry("ipv6");
    const last = getEntry("lastName");
    // spot-check the rows straddling the 0x10000 boundary plus the tail
    for (const r of [0, 65534, 65535, 65536, 69999]) {
      const row = ds.rows[r]!;
      expect(isReserved(ip6, row[0]!), `ipv6 row ${r} = ${row[0]}`).toBe(true);
      expect(isReserved(last, row[1]!), `lastName row ${r} = ${row[1]}`).toBe(true);
    }
  });
});

describe("generate.rejectsInvalidRuntimeOptions", () => {
  const schema: FieldSchema[] = [{ name: "email", type: "email" }];
  const oversizedSchema: FieldSchema[] = Array.from(
    { length: MAX_SCHEMA_FIELDS + 1 },
    (_, index) => ({ name: `field_${index}`, type: "email" }),
  );

  it.each([
    ["missing options", undefined],
    ["empty schema", { schema: [], rows: 1, seed: 1 }],
    ["zero rows", { schema, rows: 0, seed: 1 }],
    ["infinite rows", { schema, rows: Infinity, seed: 1 }],
    ["fractional rows", { schema, rows: 1.5, seed: 1 }],
    ["rows above the resource cap", { schema, rows: 100_001, seed: 1 }],
    ["schema above the field cap", { schema: oversizedSchema, rows: 1, seed: 1 }],
    [
      "column name above the length cap",
      { schema: [{ name: "a".repeat(MAX_COLUMN_NAME_LENGTH + 1), type: "email" }], rows: 1, seed: 1 },
    ],
    ["negative seed", { schema, rows: 1, seed: -1 }],
    ["fractional seed", { schema, rows: 1, seed: 1.5 }],
    ["seed above uint32", { schema, rows: 1, seed: 0x1_0000_0000 }],
    ["duplicate names", { schema: [...schema, ...schema], rows: 1, seed: 1 }],
    ["unknown field type", { schema: [{ name: "email", type: "unknown" }], rows: 1, seed: 1 }],
  ])("rejects %s", (_label, options) => {
    expect(() => generate(options as never)).toThrow();
  });

  it("rejects spreadsheet-formula prefixes in caller-controlled CSV headers", () => {
    for (const name of ["=HYPERLINK(\"https://example.com\")", " +SUM(1,1)", "-1+2", "@SUM(1,1)"]) {
      expect(() => generate({ schema: [{ name, type: "email" }], rows: 1, seed: 1 })).toThrow(
        /must not begin with/i,
      );
    }
  });

  it("normalizes underscore-heavy opaque field names without changing the fake-data boundary", () => {
    const result = generate({
      schema: [
        { name: "___account___id___", type: "opaqueId" },
        { name: "_".repeat(MAX_COLUMN_NAME_LENGTH), type: "opaqueId" },
      ],
      rows: 1,
      seed: 1,
    });
    expect(result.rows[0]![0]).toBe("TEST_ACCOUNT_ID_000001");
    expect(result.rows[0]![1]).toBe("TEST_ID_000001");
  });
});
