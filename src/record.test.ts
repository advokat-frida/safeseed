import { describe, it, expect } from "vitest";
import { generate, type FieldSchema, type GeneratedDataset } from "./generate.js";
import { CATALOG_VERSION } from "./catalog.js";
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

const TIERS: Tier[] = [
  "protocol-reserved",
  "authority-reserved",
  "designated-test-only",
  "structurally-fake",
];

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

  it("accepts added CSV columns but requires every declared field to match the dataset", async () => {
    const { ds, csv } = await build();
    const lines = csv.trimEnd().split("\n");
    const extended = `${lines[0]},role\n${lines.slice(1).map((line) => `${line},tester`).join("\n")}\n`;
    const record = await makeRunRecord(ds, extended);
    expect(record.contentSha256).toBe(await sha256Hex(extended));

    const mismatched = extended.replace("user1@", "user99@");
    await expect(makeRunRecord(ds, mismatched)).rejects.toThrow(/does not match dataset field/i);
  });

  it("rejects a structurally supplied dataset whose value is outside the current catalog", async () => {
    const { ds } = await build();
    const forged = {
      ...ds,
      rows: ds.rows.map((row, index) => (index === 0 ? ["real.person@gmail.com", ...row.slice(1)] : row)),
    };
    const forgedCsv = toCsv(forged.columns, forged.rows);
    await expect(makeRunRecord(forged, forgedCsv)).rejects.toThrow(/outside the current email catalog/i);
  });

  it("rejects an empty structural dataset instead of creating a meaningless record", async () => {
    const empty: GeneratedDataset = {
      columns: [],
      rows: [],
      schema: [],
      seed: 1,
      catalogVersion: CATALOG_VERSION,
    };
    await expect(makeRunRecord(empty, "\n")).rejects.toThrow(/at least one declared field/i);
  });

  it("rejects a structurally supplied spreadsheet-formula header", async () => {
    const { ds } = await build();
    const unsafeName = "=HYPERLINK(\"https://example.com\")";
    const forged: GeneratedDataset = {
      ...ds,
      columns: [unsafeName, ...ds.columns.slice(1)],
      schema: [{ ...ds.schema[0]!, name: unsafeName }, ...ds.schema.slice(1)],
    };
    await expect(makeRunRecord(forged, toCsv(forged.columns, forged.rows))).rejects.toThrow(
      /spreadsheet formula marker/i,
    );
  });
});

describe("record.includesPerColumnHashes", () => {
  it("every field carries a stable sha256 over its column", async () => {
    const { record } = await build();
    for (const f of record.fields) {
      expect(f.sha256, `${f.name} missing per-column hash`).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("per-column hashes are deterministic for the same seed", async () => {
    const a = await build();
    const b = await build();
    expect(a.record.fields.map((f) => f.sha256)).toEqual(b.record.fields.map((f) => f.sha256));
  });

  it("a per-column hash changes when that column changes; untouched columns hold", async () => {
    const ds = generate({ schema: SCHEMA, rows: 12, seed: 5 });
    const baseRec = await makeRunRecord(ds, toCsv(ds.columns, ds.rows));
    const cardIdx = ds.columns.indexOf("card");
    // Swap one card cell for a different reserved test PAN — only the card column moves.
    const mutated = {
      ...ds,
      rows: ds.rows.map((r, i) =>
        i === 0
          ? r.map((v, c) =>
              c === cardIdx ? (v === "4242424242424242" ? "4111111111111111" : "4242424242424242") : v,
            )
          : r,
      ),
    };
    const mutRec = await makeRunRecord(mutated, toCsv(mutated.columns, mutated.rows));
    const hashOf = (rec: typeof baseRec, name: string) => rec.fields.find((f) => f.name === name)!.sha256;
    expect(hashOf(mutRec, "card")).not.toBe(hashOf(baseRec, "card"));
    expect(hashOf(mutRec, "last")).toBe(hashOf(baseRec, "last"));
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

  it("records derivation for hashes without relabelling the digest itself as reserved", async () => {
    const schema: FieldSchema[] = [
      { name: "email_sha256", type: "sha256Email" },
      { name: "phone_sha256", type: "sha256Phone" },
      { name: "email", type: "email" },
    ];
    const ds = generate({ schema, rows: 4, seed: 8 });
    const record = await makeRunRecord(ds, toCsv(ds.columns, ds.rows));
    expect(record.fields[0]!.derivation).toMatch(/SHA-256/i);
    expect(record.fields[1]!.derivation).toMatch(/SHA-256/i);
    expect(record.fields[2]!.derivation).toBeUndefined();
    expect(record.fields[0]!.claim).toMatch(/digest itself is neither reserved/i);
  });
});

describe("record.usesHonestLanguageNoOverclaim", () => {
  it("keeps the attestation readable around the derivation boundary", () => {
    expect(ATTESTATION).toContain("unsigned integrity record, not authenticated provenance");
    expect(ATTESTATION).toContain("Where a field names a derivation");
  });
  const banned = [
    /\bproof\b/i,
    /\bproven\b/i,
    /cannot be (a )?real/i,
    /cannot correspond/i,
    /\bimpossible/i,
    /\bguarantee/i,
  ];

  it("all current claims avoid absolute impossibility and lifetime-policy language", async () => {
    const { record } = await build();
    for (const f of record.fields) {
      for (const re of banned) {
        expect(re.test(f.claim), `${f.tier} claim overclaims: "${f.claim}"`).toBe(false);
      }
    }
  });

  it("the attestation explicitly disclaims being a proof of no-PII", () => {
    expect(/unsigned run record/i.test(ATTESTATION)).toBe(true);
    expect(/caller's declaration/i.test(ATTESTATION)).toBe(true);
    expect(/cannot authenticate how/i.test(ATTESTATION)).toBe(true);
    expect(/not a cryptographic proof/i.test(ATTESTATION)).toBe(true);
    expect(/not the same (claim )?as/i.test(ATTESTATION)).toBe(true);
    expect(/does not attest any column omitted from its fields list/i.test(ATTESTATION)).toBe(true);
    expect(/overall file contains no personal data/i.test(ATTESTATION)).toBe(true);
    expect(/can recompute both/i.test(ATTESTATION)).toBe(true);
    expect(/independently protected copy/i.test(ATTESTATION)).toBe(true);
  });
});
