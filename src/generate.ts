/**
 * Schema-driven, deterministic generation of catalog-constrained test data.
 *
 * Every PII-shaped value is drawn from the cited reserved ranges in `catalog.ts`;
 * structurally-fake fields (names, addresses) are emitted as self-evidently fake
 * tokens. Output is a function of (schema, seed), so a generated dataset is a
 * committable, reviewable fixture.
 */
import { CATALOG, CATALOG_VERSION, getEntry } from "./catalog.js";
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
const FIELD_TYPES = new Set<string>(CATALOG.map((entry) => entry.field));
const SINGLE_LINE = /^[^\r\n\u0000-\u001f\u007f]+$/;
const SPREADSHEET_FORMULA_PREFIX = new Set([
  "=",
  "+",
  "-",
  "@",
]);
export const MAX_GENERATE_ROWS = 100_000;
export const MAX_GENERATE_SEED = 0xffffffff;
export const MAX_SCHEMA_FIELDS = 256;
export const MAX_COLUMN_NAME_LENGTH = 256;

/**
 * SafeSeed writes schema names into the first CSV row. Keep that caller-controlled
 * surface single-line and prevent common spreadsheet formula prefixes, including
 * when hidden behind leading whitespace. CSV quoting alone does not neutralize a
 * spreadsheet formula.
 */
export function isSafeColumnName(name: unknown): name is string {
  if (
    typeof name !== "string" ||
    name.length > MAX_COLUMN_NAME_LENGTH ||
    !SINGLE_LINE.test(name) ||
    name.trim() === ""
  ) {
    return false;
  }
  return !SPREADSHEET_FORMULA_PREFIX.has(name.trimStart()[0] ?? "");
}

function assertGenerateOptions(opts: GenerateOptions): void {
  if (typeof opts !== "object" || opts === null || Array.isArray(opts)) {
    throw new TypeError("generate options must be an object");
  }
  if (!Array.isArray(opts.schema) || opts.schema.length === 0) {
    throw new TypeError("schema must contain at least one field");
  }
  if (opts.schema.length > MAX_SCHEMA_FIELDS) {
    throw new RangeError(`schema must contain at most ${MAX_SCHEMA_FIELDS} fields`);
  }
  if (!Number.isSafeInteger(opts.rows) || opts.rows < 1 || opts.rows > MAX_GENERATE_ROWS) {
    throw new RangeError(`rows must be an integer from 1 to ${MAX_GENERATE_ROWS}`);
  }
  if (!Number.isSafeInteger(opts.seed) || opts.seed < 0 || opts.seed > MAX_GENERATE_SEED) {
    throw new RangeError(`seed must be an integer from 0 to ${MAX_GENERATE_SEED}`);
  }
  if (opts.formatValid !== undefined && typeof opts.formatValid !== "boolean") {
    throw new TypeError("formatValid must be a boolean when provided");
  }

  const names = new Set<string>();
  opts.schema.forEach((field, index) => {
    if (typeof field !== "object" || field === null || Array.isArray(field)) {
      throw new TypeError(`schema field ${index} must be an object`);
    }
    if (
      typeof field.name !== "string" ||
      field.name.length > MAX_COLUMN_NAME_LENGTH ||
      !SINGLE_LINE.test(field.name) ||
      field.name.trim() === ""
    ) {
      throw new TypeError(
        `schema field ${index} name must be a non-empty single-line string no longer than ${MAX_COLUMN_NAME_LENGTH} characters`,
      );
    }
    if (!isSafeColumnName(field.name)) {
      throw new TypeError(
        `schema field ${index} name must not begin with =, +, -, or @ after leading whitespace`,
      );
    }
    if (names.has(field.name)) {
      throw new TypeError(`schema field names must be unique; duplicate "${field.name}"`);
    }
    names.add(field.name);
    if (typeof field.type !== "string" || !FIELD_TYPES.has(field.type)) {
      throw new TypeError(`schema field ${index} has an unknown type`);
    }
  });
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function trimEdgeUnderscores(value: string): string {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) === 95) start += 1;

  let end = value.length;
  while (end > start && value.charCodeAt(end - 1) === 95) end -= 1;

  return value.slice(start, end);
}

function opaquePrefix(fieldName: string): string {
  const normalized = fieldName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const trimmed = trimEdgeUnderscores(normalized).slice(0, 40);
  return trimmed || "ID";
}

function generateValue(
  type: FieldType,
  rng: () => number,
  row: number,
  formatValid: boolean,
  fieldName: string,
): string {
  switch (type) {
    case "email":
      return formatValid
        ? `user${row}@${pick(rng, EMAIL_DOMAINS)}`
        : `test_${pad(row, 6)}@example.invalid`;
    case "sha256Email": {
      const reserved = getEntry(type).reserved;
      if (reserved.kind !== "sha256Allowlist") throw new Error("sha256Email catalog shape mismatch");
      return reserved.values[(row - 1) % reserved.values.length]!.digest;
    }
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
    case "ukPhone": {
      const reserved = getEntry(type).reserved;
      if (reserved.kind !== "ukDramaPhoneBlock") throw new Error("ukPhone catalog shape mismatch");
      const subscriber = pad(intBetween(rng, reserved.subscriberStart, reserved.subscriberEnd), 3);
      const national = `${reserved.nationalPrefix}${subscriber}`;
      return formatValid
        ? `+44${national.slice(1)}`
        : `${national.slice(0, 5)} ${national.slice(5)}`;
    }
    case "sha256Phone": {
      const reserved = getEntry(type).reserved;
      if (reserved.kind !== "sha256Allowlist") throw new Error("sha256Phone catalog shape mismatch");
      return reserved.values[(row - 1) % reserved.values.length]!.digest;
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
    case "marketingUrl": {
      const reserved = getEntry(type).reserved;
      if (reserved.kind !== "marketingUrl") throw new Error("marketingUrl catalog shape mismatch");
      const query = reserved.params
        .map(({ name, tokenPrefix }) => `${name}=TEST_${tokenPrefix}_${pad(row, 6)}`)
        .join("&");
      return `${reserved.baseUrl}?${query}`;
    }
    case "opaqueId":
      return `TEST_${opaquePrefix(fieldName)}_${pad(row, 6)}`;
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
  assertGenerateOptions(opts);
  const formatValid = opts.formatValid ?? true;
  const rng = mulberry32(opts.seed);
  const columns = opts.schema.map((f) => f.name);
  const rows: string[][] = [];
  for (let i = 0; i < opts.rows; i++) {
    const row: string[] = [];
    for (const field of opts.schema) {
      row.push(generateValue(field.type, rng, i + 1, formatValid, field.name));
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
