import { describe, it, expect } from "vitest";
import { generate, type FieldSchema } from "./generate.js";
import { getEntry, isReserved, isSelfEvidentlyFake } from "./catalog.js";
import { luhnValid } from "./luhn.js";

const FULL_SCHEMA: FieldSchema[] = [
  { name: "email", type: "email" },
  { name: "domain", type: "domain" },
  { name: "ip", type: "ipv4" },
  { name: "ip6", type: "ipv6" },
  { name: "phone", type: "phone" },
  { name: "ssn", type: "ssn" },
  { name: "card", type: "creditCard" },
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
