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

  it("accepts generated practical marketing fields and flags shape-valid substitutes", () => {
    const columns: ScanColumn[] = [
      { name: "email_sha256", type: "sha256Email" },
      { name: "phone_sha256", type: "sha256Phone" },
      { name: "phone_uk", type: "ukPhone" },
      { name: "landing_page_url", type: "marketingUrl" },
      { name: "cookie_id", type: "opaqueId" },
    ];
    const ds = generate({ schema: columns as FieldSchema[], rows: 3, seed: 12 });
    expect(scan({ csv: toCsv(ds.columns, ds.rows), columns }).ok).toBe(true);

    const changed = ds.rows.map((row) => [...row]);
    changed[0]![0] = "a".repeat(64);
    changed[0]![1] = "0".repeat(64);
    changed[0]![2] = "+447700901000";
    changed[0]![3] = "https://campaign.example.com/landing?utm_source=google&utm_medium=cpc&utm_campaign=real";
    changed[0]![4] = "actual-cookie-id-123";
    const result = scan({ csv: toCsv(ds.columns, changed), columns });
    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.field).sort()).toEqual(
      columns.map((column) => column.name).sort(),
    );
  });
});

describe("scan.rejectsMalformedCsv", () => {
  it("fails closed instead of treating an unclosed quoted value as a clean reserved email", () => {
    const result = scan({ csv: 'email\n"user1@example.net', columns: [{ name: "email", type: "email" }] });
    expect(result.ok).toBe(false);
    expect(result.scannedRows).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.parseErrors).toHaveLength(1);
    expect(result.parseErrors[0]).toMatch(/malformed CSV/i);
  });
});

describe("scan.rejectsCompositeCellsInsteadOfNormalizingToASafeSuffix", () => {
  it("flags embedded real-looking email, phone, SSN, and card content", () => {
    const columns: ScanColumn[] = [
      { name: "email", type: "email" },
      { name: "phone", type: "phone" },
      { name: "ssn", type: "ssn" },
      { name: "card", type: "creditCard" },
    ];
    const csv = toCsv(
      columns.map((column) => column.name),
      [[
        "real.person@gmail.com\nfake@example.com",
        "(212) 867-5309 / (800) 555-0100",
        "123-45-6789 / 123-00-6789",
        "1234567890123456 / 4242424242424242",
      ]],
    );

    const result = scan({ csv, columns });
    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.field).sort()).toEqual([
      "card",
      "email",
      "phone",
      "ssn",
    ]);
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

describe("scan.failsClosedOnMalformedRows", () => {
  it("rejects an unheadered trailing cell instead of ignoring it", () => {
    const csv = "email\nfake@example.com,real.person@gmail.com\n";
    const result = scan({ csv, columns: [{ name: "email", type: "email" }] });
    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.malformedRows).toEqual([0]);
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
    expect(result.malformedRows).toEqual([]);
  });
});
