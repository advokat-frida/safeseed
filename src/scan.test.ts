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

describe("scan.reportsMissingNamedColumns", () => {
  it("fails instead of passing silently when no named column is in the header", () => {
    const csv = ["user,notes", "jane,hello"].join("\n");
    const result = scan({ csv, columns: COLUMNS });
    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.missingColumns).toEqual(["email", "phone"]);
    expect(result.duplicateColumns).toEqual([]);
  });

  it("still scans the named columns that ARE present, and reports the rest missing", () => {
    const csv = ["email,notes", "real@gmail.com,hello"].join("\n");
    const result = scan({ csv, columns: COLUMNS });
    expect(result.ok).toBe(false);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0]!.field).toBe("email");
    expect(result.missingColumns).toEqual(["phone"]);
  });
});

describe("scan.matchesHeadersCaseInsensitively", () => {
  it("matches BOM-prefixed, padded, and case-variant headers to the named columns", () => {
    const csv = ["﻿ Email ,PHONE", "john.smith@gmail.com,212-867-5309"].join("\n");
    const result = scan({ csv, columns: COLUMNS });
    expect(result.missingColumns).toEqual([]);
    expect(result.duplicateColumns).toEqual([]);
    expect(result.findings.length).toBe(2);
    expect(result.perField["email"]).toBe(1);
    expect(result.perField["phone"]).toBe(1);
  });
});

describe("scan.reportsAmbiguousDuplicateHeaders", () => {
  it("refuses to guess between duplicate headers and reports the column as ambiguous", () => {
    const csv = ["email,Email,phone", "real@gmail.com,alice@example.com,(800) 555-0142"].join("\n");
    const result = scan({ csv, columns: COLUMNS });
    expect(result.ok).toBe(false);
    expect(result.duplicateColumns).toEqual(["email"]);
    expect(result.missingColumns).toEqual([]);
    // the ambiguous column is not scanned at all; the unambiguous one still is
    expect(result.findings).toEqual([]);
    expect(result.perField["email"]).toBe(0);
    expect(result.perField["phone"]).toBe(0);
  });
});

describe("scan.cleanResultCarriesEmptyColumnReports", () => {
  it("returns empty missing/duplicate arrays on a fully-matched clean scan", () => {
    const ds = generate({ schema: COLUMNS as FieldSchema[], rows: 5, seed: 7 });
    const csv = toCsv(ds.columns, ds.rows);
    const result = scan({ csv, columns: COLUMNS });
    expect(result.ok).toBe(true);
    expect(result.missingColumns).toEqual([]);
    expect(result.duplicateColumns).toEqual([]);
  });
});
