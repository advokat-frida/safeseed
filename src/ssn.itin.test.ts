/**
 * The ITIN correction (0.2.1 / catalog 2.0.0).
 *
 * SafeSeed 0.2.0 treated SSN areas 900-999 as "never assigned" and generated from
 * them. That was wrong: 9XX-XX-XXXX is the IRS ITIN space — real, issued
 * identifiers, with group ranges the IRS has EXPANDED over time. This suite pins
 * the corrected behavior: the reserved definition is exactly the components never
 * issued under BOTH the SSA scheme and the IRS ITIN scheme (area 000, area 666,
 * group 00, serial 0000); generation never touches the 9XX space at all; scan
 * flags ITIN-pattern values (including SafeSeed 0.2.0's own old output); and old
 * catalog-1.0.0 records fail verify with an explanatory warning, by design.
 */
import { describe, it, expect } from "vitest";
import { getEntry, isReserved, CATALOG_VERSION } from "./catalog.js";
import { generate, type FieldSchema, type GeneratedDataset } from "./generate.js";
import { scan } from "./scan.js";
import { verify } from "./verify.js";
import { makeRunRecord } from "./record.js";
import { toCsv } from "./csv.js";

const SSN = getEntry("ssn");

describe("ssn.itinSpaceIsNotReserved", () => {
  it("treats valid ITIN-pattern values (9XX area, IRS group digits) as candidate real data", () => {
    // One value from each currently-issued IRS ITIN group range: 50-65, 70-88, 90-92, 94-99.
    const itins = [
      "912-70-1234", // the canonical example from the incident
      "900-50-0001",
      "950-65-4321",
      "999-88-9999",
      "901-90-1111",
      "902-92-2222",
      "987-94-3333",
      "998-99-0001",
    ];
    for (const v of itins) {
      expect(isReserved(SSN, v), `${v} is a real-pattern ITIN and must NOT be reserved`).toBe(false);
    }
  });

  it("treats the ENTIRE 9xx area space as unreserved, robust to future ITIN group expansion", () => {
    // Even 9xx values whose group is outside today's ITIN ranges are not blessed:
    // the IRS has expanded ITIN group ranges before and may again.
    for (const v of ["912-45-1234", "900-12-3456", "999-43-3811", "987-68-6106"]) {
      expect(isReserved(SSN, v), `${v} sits in the ITIN area space and must NOT be reserved`).toBe(false);
    }
  });

  it("still reserves the components never issued under both schemes", () => {
    expect(isReserved(SSN, "000-12-3456")).toBe(true); // area 000
    expect(isReserved(SSN, "666-12-3456")).toBe(true); // area 666
    expect(isReserved(SSN, "123-00-4567")).toBe(true); // group 00
    expect(isReserved(SSN, "123-45-0000")).toBe(true); // serial 0000
  });
});

describe("ssn.generatedValuesAreNeverIssuedInBothSchemes", () => {
  const SCHEMA: FieldSchema[] = [{ name: "ssn", type: "ssn" }];

  it("every generated ssn is format-shaped, in the new reserved range, and never in the ITIN space", () => {
    for (const seed of [0, 1, 7, 42, 1337, 987654]) {
      const ds = generate({ schema: SCHEMA, rows: 2000, seed });
      for (const [value] of ds.rows) {
        expect(value, `seed ${seed}`).toMatch(/^\d{3}-\d{2}-\d{4}$/);
        expect(isReserved(SSN, value!), `seed ${seed}: "${value}" left the reserved range`).toBe(true);
        const [area, group, serial] = value!.split("-") as [string, string, string];
        // Never-issued under BOTH schemes: group 00 or serial 0000 (or a 000/666 area).
        const neverIssuedBoth =
          group === "00" || serial === "0000" || area === "000" || area === "666";
        expect(neverIssuedBoth, `seed ${seed}: "${value}" has no never-issued component`).toBe(true);
      }
    }
  });

  it("NEVER generates a value in the 9xx ITIN area space (property test, large seeded sample)", () => {
    for (const seed of [0, 1, 7, 42, 1337, 24601, 987654]) {
      const ds = generate({ schema: SCHEMA, rows: 3000, seed });
      for (const [value] of ds.rows) {
        expect(
          /^9\d{2}-/.test(value!),
          `seed ${seed}: generated "${value}" collides with the IRS ITIN area space`,
        ).toBe(false);
      }
    }
  });
});

describe("ssn.scanFlagsItinValues", () => {
  it("flags a genuine ITIN pattern and SafeSeed 0.2.0's own old output as candidate PII", () => {
    const csv = [
      "ssn",
      "912-70-1234", // valid ITIN pattern — a real person may hold this
      "900-12-3456", // SafeSeed 0.2.0's old output style — no longer blessed
      "123-00-4567", // new-range value — stays clean
    ].join("\n");
    const result = scan({ csv, columns: [{ name: "ssn", type: "ssn" }] });
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.value).sort()).toEqual(["900-12-3456", "912-70-1234"]);
    expect(result.perField["ssn"]).toBe(2);
  });
});

describe("generate.nonSsnColumnsUnchangedAcrossSsnRangeFix", () => {
  it("emits byte-identical non-ssn columns for the same seed as 0.2.0 did", () => {
    // Golden values captured from safeseed 0.2.0 (schema below, rows 8, seed 42)
    // BEFORE the ssn scheme changed. The ssn generator still consumes exactly three
    // RNG draws per value, so every other column must reproduce these exactly.
    const schema: FieldSchema[] = [
      { name: "email", type: "email" },
      { name: "ssn", type: "ssn" },
      { name: "phone", type: "phone" },
      { name: "card", type: "creditCard" },
      { name: "last", type: "lastName" },
    ];
    const ds = generate({ schema, rows: 8, seed: 42 });
    const column = (i: number) => ds.rows.map((r) => r[i]);
    expect(column(0)).toEqual([
      "user1@example.net",
      "user2@example.net",
      "user3@example.com",
      "user4@example.com",
      "user5@example.net",
      "user6@example.net",
      "user7@example.com",
      "user8@example.com",
    ]);
    expect(column(2)).toEqual([
      "(616) 555-0117",
      "(789) 555-0188",
      "(571) 555-0100",
      "(346) 555-0106",
      "(839) 555-0148",
      "(393) 555-0159",
      "(361) 555-0150",
      "(932) 555-0169",
    ]);
    expect(column(3)).toEqual([
      "4000056655665556",
      "5555555555554444",
      "6011111111111117",
      "371449635398431",
      "5555555555554444",
      "378282246310005",
      "4000056655665556",
      "4242424242424242",
    ]);
    expect(column(4)).toEqual([
      "TEST_Lastname_000001",
      "TEST_Lastname_000002",
      "TEST_Lastname_000003",
      "TEST_Lastname_000004",
      "TEST_Lastname_000005",
      "TEST_Lastname_000006",
      "TEST_Lastname_000007",
      "TEST_Lastname_000008",
    ]);
  });
});

describe("verify.oldCatalogRecordsFailWithClearMessage", () => {
  // A hand-built dataset standing in for safeseed 0.2.0 output: 9xx-area SSNs,
  // recorded under catalog 1.0.0. The content hash is genuine (makeRunRecord
  // computes it from these exact bytes), so ONLY the range check + version
  // warning are in play — exactly the old-record-meets-new-catalog situation.
  async function buildOldStyle() {
    const schema: FieldSchema[] = [{ name: "ssn", type: "ssn" }];
    const rows = [["900-12-3456"], ["910-85-6697"], ["666-41-9752"]];
    const ds: GeneratedDataset = {
      columns: ["ssn"],
      rows,
      schema,
      seed: 42,
      catalogVersion: "1.0.0",
    };
    const csv = toCsv(ds.columns, ds.rows);
    const record = await makeRunRecord(ds, csv);
    expect(record.catalogVersion).toBe("1.0.0");
    return { csv, record };
  }

  it("strict verify fails the 9xx values and explains the catalog change (no crash, no re-blessing)", async () => {
    const { csv, record } = await buildOldStyle();
    const result = await verify(csv, record);
    expect(result.ok).toBe(false);
    // The two ITIN-space rows fail the range check; the 666 row is still reserved.
    const outOfRange = result.failures.filter((f) => f.kind === "out-of-range-value");
    expect(outOfRange.map((f) => f.value).sort()).toEqual(["900-12-3456", "910-85-6697"]);
    // The failure is explained: one warning names both catalog versions and the ITIN reason.
    const w = result.warnings.find((x) => x.includes("catalog 1.0.0"));
    expect(w, "expected a catalog-version warning").toBeDefined();
    expect(w).toContain(`catalog ${CATALOG_VERSION}`);
    expect(w).toContain("ITIN");
  });

  it("column-scoped verify carries the same warning and still fails the old range", async () => {
    const { csv, record } = await buildOldStyle();
    const result = await verify(csv, record, { allowAddedColumns: true });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "out-of-range-value")).toBe(true);
    expect(result.warnings.some((x) => x.includes("catalog 1.0.0"))).toBe(true);
  });

  it("a record made under the current catalog gets no version warning", async () => {
    const schema: FieldSchema[] = [{ name: "ssn", type: "ssn" }];
    const ds = generate({ schema, rows: 5, seed: 7 });
    const csv = toCsv(ds.columns, ds.rows);
    const record = await makeRunRecord(ds, csv);
    const result = await verify(csv, record);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
