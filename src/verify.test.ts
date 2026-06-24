import { describe, it, expect } from "vitest";
import { generate, type FieldSchema } from "./generate.js";
import { toCsv } from "./csv.js";
import { sha256Hex } from "./hash.js";
import { makeRunRecord } from "./record.js";
import { verify, exitCode } from "./verify.js";

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

describe("verify.passesOnUntouchedOutput", () => {
  it("verifies a freshly generated file against its record", async () => {
    const { csv, record } = await build();
    const result = await verify(csv, record);
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.checked.rows).toBe(record.rowCount);
  });
});

describe("verify.failsOnContentHashMismatch", () => {
  it("flags an edited file whose record was not updated", async () => {
    const { csv, record } = await build();
    // Swap one reserved card for another reserved card: still in range, but the
    // bytes changed, so only the hash check should catch it.
    const tampered = csv.replace("4242424242424242", "4111111111111111");
    const result = await verify(tampered === csv ? csv + "\n" : tampered, record);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "content-hash-mismatch")).toBe(true);
  });
});

describe("verify.failsOnOutOfRangeValue", () => {
  it("flags a real-looking value even when the hash is recomputed to match", async () => {
    const { csv, record } = await build();
    const tampered = csv.replace(/\(\d{3}\) 555-01\d{2}/, "(212) 867-5309");
    expect(tampered).not.toBe(csv);
    // Attacker recomputes the hash so the tamper-evidence check passes...
    record.contentSha256 = await sha256Hex(tampered);
    const result = await verify(tampered, record);
    // ...but the range check still catches the out-of-range phone number.
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "out-of-range-value")).toBe(true);
    const finding = result.failures.find((f) => f.kind === "out-of-range-value")!;
    expect(finding.field).toBe("phone");
  });
});

describe("verify.exitsNonZeroOnDrift", () => {
  it("returns exit code 0 on a clean file and non-zero on drift", async () => {
    const { csv, record } = await build();
    const clean = await verify(csv, record);
    expect(exitCode(clean)).toBe(0);

    const drifted = await verify(csv + "extra", record);
    expect(exitCode(drifted)).not.toBe(0);
  });
});

describe("verify.failsOnAppendedTrailingColumn", () => {
  it("rejects an appended real-PII column even when the hash is recomputed to match", async () => {
    const { csv, record } = await build();
    // Attacker appends a trailing column of real emails to each data row and
    // recomputes the content hash so the tamper-evidence check passes.
    const lines = csv.split("\n");
    const tampered = lines
      .map((line, i) => (i === 0 || line === "" ? line : `${line},victim.real@gmail.com`))
      .join("\n");
    expect(tampered).not.toBe(csv);
    record.contentSha256 = await sha256Hex(tampered);

    const result = await verify(tampered, record);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.kind === "row-arity-mismatch")).toBe(true);
  });

  it("rejects a short row (missing value)", async () => {
    const { ds, record } = await build();
    const shortRows = ds.rows.map((r, i) => (i === 0 ? r.slice(0, -1) : r));
    const tampered = toCsv(ds.columns, shortRows);
    record.contentSha256 = await sha256Hex(tampered);
    const result = await verify(tampered, record);
    expect(result.ok).toBe(false);
  });
});
