import { describe, it, expect } from "vitest";
import { generate, type FieldSchema } from "./generate.js";
import { toCsv, parseCsv } from "./csv.js";
import { makeRunRecord } from "./record.js";
import { verify } from "./verify.js";

// Column-scoped verify: an opt-in mode that attests only the DECLARED synthetic
// columns (by header name, order-independent) via per-column hash + range, and
// REPORTS added business columns as unattested rather than failing on them. Strict
// whole-file verify stays the default; this mode is `{ allowAddedColumns: true }`.

const SCHEMA: FieldSchema[] = [
  { name: "email", type: "email" },
  { name: "phone", type: "phone" },
  { name: "card", type: "creditCard" },
  { name: "last", type: "lastName" },
];

async function build(seed = 1, rows = 10) {
  const ds = generate({ schema: SCHEMA, rows, seed });
  const csv = toCsv(ds.columns, ds.rows);
  const record = await makeRunRecord(ds, csv);
  return { ds, csv, record };
}

/** Append a business column the team controls (out of SafeSeed's scope). */
function addColumn(csv: string, header: string, cell: (i: number) => string): string {
  const { columns, rows } = parseCsv(csv);
  return toCsv([...columns, header], rows.map((r, i) => [...r, cell(i)]));
}

describe("verify.columnScoped.passesWithAddedColumns", () => {
  it("passes when a business column is added, and reports it unattested", async () => {
    const { csv, record } = await build();
    const extended = addColumn(csv, "job_title", () => "Engineer");
    const result = await verify(extended, record, { allowAddedColumns: true });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.unattestedColumns).toContain("job_title");
  });
});

describe("verify.columnScoped.failsOnMissingDeclaredColumn", () => {
  it("fails (missing-column) when a declared synthetic column is dropped", async () => {
    const { csv, record } = await build();
    const { columns, rows } = parseCsv(csv);
    const dropIdx = columns.indexOf("phone");
    const dropped = toCsv(
      columns.filter((_, i) => i !== dropIdx),
      rows.map((r) => r.filter((_, i) => i !== dropIdx)),
    );
    const result = await verify(dropped, record, { allowAddedColumns: true });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "missing-column" && f.field === "phone")).toBe(true);
  });
});

describe("verify.columnScoped.failsOnInRangeEditToSyntheticColumn", () => {
  it("fails (column-hash-mismatch) on an in-range swap of a synthetic value", async () => {
    const { csv, record } = await build();
    const { columns, rows } = parseCsv(csv);
    const cardIdx = columns.indexOf("card");
    // Swap one reserved test PAN for a DIFFERENT reserved test PAN: still in range,
    // so the range check passes — only the per-column hash catches the drift.
    const orig = rows[0]![cardIdx]!;
    rows[0]![cardIdx] = orig === "4242424242424242" ? "4111111111111111" : "4242424242424242";
    const tampered = toCsv(columns, rows);
    expect(tampered).not.toBe(csv);
    const result = await verify(tampered, record, { allowAddedColumns: true });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "column-hash-mismatch" && f.field === "card")).toBe(true);
    // and NOT flagged as out-of-range, because the swapped value is still reserved
    expect(result.failures.some((f) => f.kind === "out-of-range-value")).toBe(false);
  });
});

describe("verify.columnScoped.failsOnOutOfRangeInDeclaredColumn", () => {
  it("fails (out-of-range-value) when a real value lands in a synthetic column", async () => {
    const { csv, record } = await build();
    const { columns, rows } = parseCsv(csv);
    const phoneIdx = columns.indexOf("phone");
    rows[0]![phoneIdx] = "(212) 867-5309"; // real-looking, outside the 555-01xx block
    const tampered = toCsv(columns, rows);
    const result = await verify(tampered, record, { allowAddedColumns: true });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "out-of-range-value" && f.field === "phone")).toBe(true);
  });
});

describe("verify.columnScoped.reportsUnattestedColumns", () => {
  it("lists every added column, in file order", async () => {
    const { csv, record } = await build();
    let extended = addColumn(csv, "job_title", () => "Engineer");
    extended = addColumn(extended, "department", () => "Privacy");
    const result = await verify(extended, record, { allowAddedColumns: true });
    expect(result.ok).toBe(true);
    expect(result.unattestedColumns).toEqual(["job_title", "department"]);
  });
});

describe("verify.columnScoped.matchesColumnsByNameNotOrder", () => {
  it("passes when declared columns are reordered around an added one", async () => {
    const { csv, record } = await build();
    const { columns, rows } = parseCsv(csv);
    // Reverse the declared columns and splice a business column into the middle.
    const order = [...columns].reverse();
    const reordered = order.map((name) => columns.indexOf(name));
    const newCols = [...order.slice(0, 2), "team", ...order.slice(2)];
    const newRows = rows.map((r) => {
      const picked = reordered.map((i) => r[i]!);
      return [...picked.slice(0, 2), "Privacy", ...picked.slice(2)];
    });
    const result = await verify(toCsv(newCols, newRows), record, { allowAddedColumns: true });
    expect(result.ok).toBe(true);
    expect(result.unattestedColumns).toEqual(["team"]);
  });
});

describe("verify.columnScoped.failsClosedOnDuplicateDeclaredColumn", () => {
  it("rejects a duplicated declared header (ambiguous) instead of resolving to the first", async () => {
    const { csv, record } = await build();
    const { columns, rows } = parseCsv(csv);
    // Adversarial: duplicate the "email" header and have the SECOND copy carry real PII.
    // Name-matching must not silently bind to the first and wave the second through.
    const dupCols = [...columns, "email"];
    const dupRows = rows.map((r) => [...r, "victim.real@gmail.com"]);
    const result = await verify(toCsv(dupCols, dupRows), record, { allowAddedColumns: true });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "schema-mismatch" && f.field === "email")).toBe(true);
  });
});

describe("verify.columnScoped.warnsOnBlankHeaderedAddedColumn", () => {
  it("passes but warns when an added column has a blank header", async () => {
    const { csv, record } = await build();
    const extended = addColumn(csv, "", () => "Engineer");
    const result = await verify(extended, record, { allowAddedColumns: true });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => /blank header/i.test(w))).toBe(true);
  });
});

describe("verify.strictRemainsDefault", () => {
  it("default verify still fails when a column is added (no opt-in)", async () => {
    const { csv, record } = await build();
    const extended = addColumn(csv, "job_title", () => "Engineer");
    const result = await verify(extended, record);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "content-hash-mismatch")).toBe(true);
    expect(result.unattestedColumns).toEqual([]);
  });
});

describe("verify.columnScoped.roundTripsGeneratorOutput", () => {
  it("plain verify passes; add a column → allow-added passes and plain fails", async () => {
    const { csv, record } = await build();
    expect((await verify(csv, record)).ok).toBe(true);
    const extended = addColumn(csv, "industry", () => "GIS");
    expect((await verify(extended, record, { allowAddedColumns: true })).ok).toBe(true);
    expect((await verify(extended, record)).ok).toBe(false);
  });
});
