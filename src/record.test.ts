import { describe, it, expect } from "vitest";
import { generate, type FieldSchema } from "./generate.js";
import { toCsv } from "./csv.js";
import { sha256Hex } from "./hash.js";
import { makeRunRecord, ATTESTATION } from "./record.js";
import type { Tier } from "./types.js";

const SCHEMA: FieldSchema[] = [
  { name: "email", type: "email" },
  { name: "phone", type: "phone" },
  { name: "card", type: "creditCard" },
  { name: "last", type: "lastName" },
];

const TIERS: Tier[] = ["provably-non-real", "designated-test-only", "structurally-fake"];

async function build() {
  const ds = generate({ schema: SCHEMA, rows: 12, seed: 5 });
  const csv = toCsv(ds.columns, ds.rows);
  const record = await makeRunRecord(ds, csv);
  return { ds, csv, record };
}

describe("record.bindsToOutputFileHash", () => {
  it("contentSha256 equals the SHA-256 of the emitted file", async () => {
    const { csv, record } = await build();
    expect(record.contentSha256).toBe(await sha256Hex(csv));
    expect(record.contentSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("records the row count and columns of the actual output", async () => {
    const { ds, record } = await build();
    expect(record.rowCount).toBe(ds.rows.length);
    expect(record.columns).toEqual(ds.columns);
  });
});

describe("record.statesTierPerField", () => {
  it("every field carries its tier, citation, and claim", async () => {
    const { record } = await build();
    expect(record.fields.map((f) => f.name)).toEqual(["email", "phone", "card", "last"]);
    for (const f of record.fields) {
      expect(TIERS).toContain(f.tier);
      expect(f.citation.trim().length).toBeGreaterThan(0);
      expect(f.claim.trim().length).toBeGreaterThan(0);
    }
    expect(record.fields.find((f) => f.name === "card")!.tier).toBe("designated-test-only");
    expect(record.fields.find((f) => f.name === "last")!.tier).toBe("structurally-fake");
  });
});

describe("record.usesHonestLanguageNoOverclaim", () => {
  const banned = [/\bproof\b/i, /\bproven\b/i, /cannot be (a )?real/i, /\bimpossible/i, /\bguarantee/i];

  it("designated-test and structurally-fake claims avoid proof/impossibility language", async () => {
    const { record } = await build();
    for (const f of record.fields) {
      if (f.tier !== "provably-non-real") {
        for (const re of banned) {
          expect(re.test(f.claim), `${f.tier} claim overclaims: "${f.claim}"`).toBe(false);
        }
      }
    }
  });

  it("the attestation explicitly disclaims being a proof of no-PII", () => {
    expect(/not a cryptographic proof/i.test(ATTESTATION)).toBe(true);
    expect(/not the same (claim )?as/i.test(ATTESTATION)).toBe(true);
  });
});
