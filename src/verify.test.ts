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

describe("verify.rejectsMalformedCsv", () => {
  it("fails closed even when the malformed bytes match the record fingerprint", async () => {
    const { record } = await build();
    const malformed = 'email\n"user1@example.net';
    record.contentSha256 = await sha256Hex(malformed);

    const result = await verify(malformed, record);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "malformed-csv" })]),
    );
    expect(result.checked.rows).toBe(0);
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

describe("verify.failsClosedOnInvalidRunRecords", () => {
  it("rejects forged current-catalog metadata instead of returning a green result", async () => {
    const { csv, record } = await build();
    const forged = structuredClone(record);
    const forgedField = forged.fields[0]! as unknown as Record<string, string>;
    forgedField.tier = "provably-non-real";
    forgedField.citation = "attacker";
    forgedField.claim = "guaranteed no real person";

    const result = await verify(csv, forged);
    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.kind === "invalid-record")).toBe(true);
  });

  it("rejects inconsistent row counts even when the file and hash are genuine", async () => {
    const { csv, record } = await build();
    record.rowCount = 999_999;
    const result = await verify(csv, record);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "invalid-record", message: expect.stringMatching(/rowCount/i) }),
      ]),
    );
  });

  it("returns invalid-record failures rather than throwing on malformed runtime JSON", async () => {
    const { csv, record } = await build();
    const malformed = {
      ...record,
      seed: Number.NaN,
      fields: [null],
    } as unknown as typeof record;

    await expect(verify(csv, malformed)).resolves.toMatchObject({
      ok: false,
      failures: expect.arrayContaining([expect.objectContaining({ kind: "invalid-record" })]),
    });
  });

  it("does not let a current record silently remove its per-column hashes", async () => {
    const { csv, record } = await build();
    delete (record.fields[0]! as Partial<(typeof record.fields)[number]>).sha256;
    const result = await verify(csv, record, { allowAddedColumns: true });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "invalid-record", message: expect.stringMatching(/sha256 must be/i) }),
      ]),
    );
  });

  it("does not let edited version fields bypass current metadata and attestation checks", async () => {
    const { csv, record } = await build();
    record.safeseedVersion = "0.2.1";
    record.catalogVersion = "2.0.0";
    record.attestation = "cryptographic proof of no PII";
    const forgedField = record.fields[0]! as unknown as Record<string, string>;
    forgedField.tier = "provably-non-real";
    forgedField.citation = "attacker";
    forgedField.claim = "guaranteed no real person";

    const result = await verify(csv, record);
    expect(result.ok).toBe(false);
    expect(result.failures.every((failure) => failure.kind === "invalid-record")).toBe(true);
    expect(result.failures.map((failure) => failure.message).join(" ")).toMatch(/regenerate|attestation/i);
  });
});
