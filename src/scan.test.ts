import { describe, it, expect } from "vitest";
import { generate, type FieldSchema } from "./generate.js";
import { toCsv } from "./csv.js";
import { scan, type ScanColumn } from "./scan.js";

const COLUMNS: ScanColumn[] = [
  { name: "email", type: "email" },
  { name: "phone", type: "phone" },
];

describe("scan.flagsNonReservedValuesAsCandidatePii", () => {
  it("flags real-looking values that fall outside reserved ranges", () => {
    const csv = [
      "email,phone",
      "john.smith@gmail.com,212-867-5309",
      "alice@example.com,(800) 555-0142",
    ].join("\n");
    const result = scan({ csv, columns: COLUMNS });
    expect(result.ok).toBe(false);
    expect(result.findings.length).toBe(2);
    const fields = result.findings.map((f) => f.field).sort();
    expect(fields).toEqual(["email", "phone"]);
  });
});

describe("scan.passesOnAllReservedData", () => {
  it("returns clean for data entirely from reserved ranges", () => {
    const ds = generate({
      schema: COLUMNS as FieldSchema[],
      rows: 30,
      seed: 11,
    });
    const csv = toCsv(ds.columns, ds.rows);
    const result = scan({ csv, columns: COLUMNS });
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.scannedRows).toBe(30);
  });
});

describe("scan.reportsPerFieldFindings", () => {
  it("counts candidate findings per column", () => {
    const csv = [
      "email,phone",
      "real1@gmail.com,212-867-5309",
      "real2@yahoo.com,(800) 555-0142",
      "ok@example.org,415-555-0150",
    ].join("\n");
    const result = scan({ csv, columns: COLUMNS });
    expect(result.perField["email"]).toBe(2);
    expect(result.perField["phone"]).toBe(1);
  });
});
