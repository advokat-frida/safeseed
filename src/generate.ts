/**
 * Schema-driven, deterministic generation of safe-by-construction test data.
 *
 * Every PII-shaped value is drawn from the cited reserved ranges in `catalog.ts`;
 * structurally-fake fields (names, addresses) are emitted as self-evidently fake
 * tokens. Output is a function of (schema, seed), so a generated dataset is a
 * committable, reviewable fixture.
 */
import { CATALOG_VERSION } from "./catalog.js";
import type { FieldType } from "./types.js";
import { mulberry32, pick, intBetween } from "./rng.js";

export interface FieldSchema {
  /** Output column name. */
  name: string;
  /** Catalog field type that governs the reserved range. */
  type: FieldType;
}

export interface GenerateOptions {
  schema: FieldSchema[];
  rows: number;
  /** Seed for deterministic output. Same seed + schema => identical dataset. */
  seed: number;
  /**
   * Format-valid mode (default true): render values in the common wire shape while
   * staying in range (10-digit phones, NNN-NN-NNNN SSNs). "Format-valid" means the
   * SHAPE passes — a strict validator that encodes issuance rules (e.g. an SSN
   * checker that rejects group 00 / serial 0000) will still reject the value, and
   * that is by design: never-issued is the safety property. When false, values are
   * rendered in a looser, even-more-obviously-test form.
   */
  formatValid?: boolean;
}

export interface GeneratedDataset {
  columns: string[];
  rows: string[][];
  schema: FieldSchema[];
  seed: number;
  catalogVersion: string;
}

const EMAIL_DOMAINS = ["example.com", "example.net", "example.org"] as const;
const IPV4_BLOCKS = [
  [192, 0, 2],
  [198, 51, 100],
  [203, 0, 113],
] as const;
// Which never-issued SSN component to force on a row: group "00" or serial "0000".
// Both are structurally excluded by the SSA's own issuance rules AND absent from the
// IRS ITIN format, so they are never-issued under both schemes. Areas are drawn from
// 001-899 (skipping 666), which keeps every generated value entirely outside the
// 9XX ITIN space — robust even if the IRS expands its ITIN group ranges again.
const SSN_NEVER_ISSUED_MARKERS = ["group", "serial"] as const;
const STREET_SUFFIX = ["Way", "St", "Ave", "Rd", "Blvd"] as const;
const CARD_TEST_NUMBERS = [
  "4242424242424242",
  "4111111111111111",
  "4000056655665556",
  "5555555555554444",
  "5105105105105100",
  "2223003122003222",
  "378282246310005",
  "371449635398431",
  "6011111111111117",
  "3530111333300000",
] as const;

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function generateValue(type: FieldType, rng: () => number, row: number, formatValid: boolean): string {
  switch (type) {
    case "email":
      return formatValid
        ? `user${row}@${pick(rng, EMAIL_DOMAINS)}`
        : `test_${pad(row, 6)}@example.invalid`;
    case "domain":
      return `host${row}.invalid`;
    case "ipv4": {
      const block = pick(rng, IPV4_BLOCKS);
      return `${block[0]}.${block[1]}.${block[2]}.${intBetween(rng, 1, 254)}`;
    }
    case "ipv6": {
      // Split the counter across two hextets so it never overflows a single hextet
      // (>0xffff) and always stays inside the RFC 3849 2001:db8::/32 documentation prefix.
      const hi = (row >>> 16) & 0xffff;
      const lo = row & 0xffff;
      return hi ? `2001:db8::${hi.toString(16)}:${lo.toString(16)}` : `2001:db8::${lo.toString(16)}`;
    }
    case "phone": {
      const line = pad(intBetween(rng, 100, 199), 4);
      if (formatValid) {
        const npa = intBetween(rng, 200, 989);
        return `(${npa}) 555-${line}`;
      }
      return `555-${line}`;
    }
    case "ssn": {
      // Never-issued under BOTH the SSA scheme and the IRS ITIN scheme (see catalog):
      // a plausible-looking area in 001-899 (never 666, never the 9XX ITIN space),
      // with group forced to "00" or serial forced to "0000" — components neither
      // authority ever issues. Exactly three RNG draws, same as every prior release,
      // so the shared seeded stream stays aligned and all other columns are
      // byte-identical for a given seed.
      const areaDraw = intBetween(rng, 1, 898);
      const area = pad(areaDraw >= 666 ? areaDraw + 1 : areaDraw, 3);
      const marker = pick(rng, SSN_NEVER_ISSUED_MARKERS);
      if (marker === "group") {
        return `${area}-00-${pad(intBetween(rng, 1, 9999), 4)}`;
      }
      return `${area}-${pad(intBetween(rng, 1, 99), 2)}-0000`;
    }
    case "creditCard":
      return pick(rng, CARD_TEST_NUMBERS);
    case "firstName":
      return `TEST_Firstname_${pad(row, 6)}`;
    case "lastName":
      return `TEST_Lastname_${pad(row, 6)}`;
    case "fullName":
      return `TEST_Person_${pad(row, 6)}`;
    case "streetAddress":
      return `${row} Example ${pick(rng, STREET_SUFFIX)}`;
    case "freeText":
      return `TEST_Text_${pad(row, 6)}`;
  }
}

export function generate(opts: GenerateOptions): GeneratedDataset {
  const formatValid = opts.formatValid ?? true;
  const rng = mulberry32(opts.seed);
  const columns = opts.schema.map((f) => f.name);
  const rows: string[][] = [];
  for (let i = 0; i < opts.rows; i++) {
    const row: string[] = [];
    for (const field of opts.schema) {
      row.push(generateValue(field.type, rng, i + 1, formatValid));
    }
    rows.push(row);
  }
  return {
    columns,
    rows,
    schema: opts.schema,
    seed: opts.seed,
    catalogVersion: CATALOG_VERSION,
  };
}
