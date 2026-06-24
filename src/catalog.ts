/**
 * The reserved-range catalog — SafeSeed's reusable core IP.
 *
 * Each entry maps a PII-shaped field type to a standards-reserved "never-real"
 * space, the citation for that reservation, its honesty tier, and the exact
 * language allowed about it. Generation, verification, and scanning all read from
 * this one table, which is what makes the promise auditable: review these few
 * hundred cited lines once, and every output inherits the guarantee.
 *
 * NOTE (pre-publication): the SSN unassigned-range claims below rest on secondary
 * sources; re-verify against ssa.gov before any public release. The RFC and NANPA
 * citations are primary-confirmed.
 */
import type { FieldType, Tier } from "./types.js";
import { ipv4InCidr, ipv6InPrefix } from "./net.js";

export const CATALOG_VERSION = "1.0.0";

/** Inspectable, structured definition of a reserved space. Drives generation,
 * verification, and scanning, and lets tests assert the ranges match standards. */
export type ReservedSpec =
  | { kind: "emailDomains"; domains: readonly string[]; reservedTlds: readonly string[] }
  | { kind: "domains"; domains: readonly string[]; reservedTlds: readonly string[] }
  | { kind: "ipv4Blocks"; cidrs: readonly string[] }
  | { kind: "ipv6Blocks"; cidrs: readonly string[] }
  | { kind: "phoneBlock"; centralOfficeCode: string; subscriberStart: number; subscriberEnd: number }
  | {
      kind: "ssnInvalid";
      invalidAreas: readonly string[];
      invalidAreaMin: number;
      invalidAreaMax: number;
      invalidGroup: string;
      invalidSerial: string;
    }
  | { kind: "cardTestNumbers"; numbers: readonly string[] }
  | { kind: "fakeToken"; pattern: string };

export interface CatalogEntry {
  field: FieldType;
  tier: Tier;
  /** Human-readable citation for the reservation. */
  citation: string;
  /** What the reserved space is, in plain words. */
  description: string;
  /** Tier-appropriate, non-overclaiming statement about values of this field. */
  claim: string;
  reserved: ReservedSpec;
}

// Tier-appropriate claim language. The strong wording lives ONLY on the provable
// tier; the weaker tiers deliberately avoid "proof", "impossible", "cannot be real".
const CLAIM_PROVABLE =
  "Reserved by published standard; values in this range cannot correspond to a real person or system.";
const CLAIM_DESIGNATED =
  "Designated test value that passes validation; non-real by network and sandbox designation, not by construction. Valid-looking, but reserved for testing.";
const CLAIM_FAKE =
  "Self-evidently synthetic token; not derived from any real record. This field type is not reserved by any standard, so realism is deliberately avoided.";

const RFC2606_DOMAINS = ["example.com", "example.net", "example.org"] as const;
const RFC2606_TLDS = ["test", "example", "invalid", "localhost"] as const;
const RFC5737_BLOCKS = ["192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24"] as const;
const RFC3849_BLOCKS = ["2001:db8::/32"] as const;

/** Network-published card test PANs (all Luhn-valid by design). */
const CARD_TEST_NUMBERS = [
  "4242424242424242", // Visa (widely used sandbox)
  "4111111111111111", // Visa
  "4000056655665556", // Visa debit
  "5555555555554444", // Mastercard
  "5105105105105100", // Mastercard
  "2223003122003222", // Mastercard (2-series)
  "378282246310005", // American Express
  "371449635398431", // American Express
  "6011111111111117", // Discover
  "3530111333300000", // JCB
] as const;

export const CATALOG: readonly CatalogEntry[] = [
  {
    field: "email",
    tier: "provably-non-real",
    citation: "RFC 2606 §2–3 (reserved example.com/.net/.org and TLDs .test/.example/.invalid/.localhost)",
    description: "Email addresses whose domain is an RFC 2606 reserved domain or TLD; can never route to a real mailbox.",
    claim: CLAIM_PROVABLE,
    reserved: { kind: "emailDomains", domains: RFC2606_DOMAINS, reservedTlds: RFC2606_TLDS },
  },
  {
    field: "domain",
    tier: "provably-non-real",
    citation: "RFC 2606 §2–3 (reserved domains and TLDs)",
    description: "Hostnames under an RFC 2606 reserved domain or TLD.",
    claim: CLAIM_PROVABLE,
    reserved: { kind: "domains", domains: RFC2606_DOMAINS, reservedTlds: RFC2606_TLDS },
  },
  {
    field: "ipv4",
    tier: "provably-non-real",
    citation: "RFC 5737 (IPv4 documentation blocks TEST-NET-1/2/3)",
    description: "IPv4 addresses inside the three RFC 5737 documentation ranges; never routed on the public Internet.",
    claim: CLAIM_PROVABLE,
    reserved: { kind: "ipv4Blocks", cidrs: RFC5737_BLOCKS },
  },
  {
    field: "ipv6",
    tier: "provably-non-real",
    citation: "RFC 3849 (IPv6 documentation prefix 2001:db8::/32)",
    description: "IPv6 addresses inside the RFC 3849 documentation prefix.",
    claim: CLAIM_PROVABLE,
    reserved: { kind: "ipv6Blocks", cidrs: RFC3849_BLOCKS },
  },
  {
    field: "phone",
    tier: "provably-non-real",
    citation: "NANPA / ATIS fictitious-number assignment (555-0100 through 555-0199)",
    description: "North American numbers in the 555-01xx fictitious subscriber block; designated non-working.",
    claim: CLAIM_PROVABLE,
    reserved: { kind: "phoneBlock", centralOfficeCode: "555", subscriberStart: 100, subscriberEnd: 199 },
  },
  {
    field: "ssn",
    tier: "provably-non-real",
    citation: "SSA assignment rules — unassigned ranges (area 000/666/900-999, group 00, serial 0000). Verify vs ssa.gov before public release.",
    description: "US SSNs whose area, group, or serial falls in a range the SSA never issues.",
    claim: CLAIM_PROVABLE,
    reserved: {
      kind: "ssnInvalid",
      invalidAreas: ["000", "666"],
      invalidAreaMin: 900,
      invalidAreaMax: 999,
      invalidGroup: "00",
      invalidSerial: "0000",
    },
  },
  {
    field: "creditCard",
    tier: "designated-test-only",
    citation: "Card-network published test PANs (Visa/Mastercard/Amex/Discover/JCB sandboxes)",
    description: "Payment card numbers the networks publish for testing. They pass Luhn, so they are non-real by designation, not impossibility.",
    claim: CLAIM_DESIGNATED,
    reserved: { kind: "cardTestNumbers", numbers: CARD_TEST_NUMBERS },
  },
  {
    field: "firstName",
    tier: "structurally-fake",
    citation: "No standard reserves names; self-evidently-fake token convention",
    description: "Given names rendered as obvious TEST_ tokens rather than plausible names.",
    claim: CLAIM_FAKE,
    reserved: { kind: "fakeToken", pattern: "^TEST_Firstname_\\d{6}$" },
  },
  {
    field: "lastName",
    tier: "structurally-fake",
    citation: "No standard reserves names; self-evidently-fake token convention",
    description: "Family names rendered as obvious TEST_ tokens.",
    claim: CLAIM_FAKE,
    reserved: { kind: "fakeToken", pattern: "^TEST_Lastname_\\d{6}$" },
  },
  {
    field: "fullName",
    tier: "structurally-fake",
    citation: "No standard reserves names; self-evidently-fake token convention",
    description: "Full names rendered as obvious TEST_ tokens.",
    claim: CLAIM_FAKE,
    reserved: { kind: "fakeToken", pattern: "^TEST_Person_\\d{6}$" },
  },
  {
    field: "streetAddress",
    tier: "structurally-fake",
    citation: "No standard reserves addresses; self-evidently-fake 'Example' convention",
    description: "Street addresses built on the self-evident 'Example' street name.",
    claim: CLAIM_FAKE,
    reserved: { kind: "fakeToken", pattern: "^\\d+ Example (Way|St|Ave|Rd|Blvd)$" },
  },
  {
    field: "freeText",
    tier: "structurally-fake",
    citation: "No standard reserves free text; self-evidently-fake token convention",
    description: "Free-text fields rendered as obvious TEST_ tokens.",
    claim: CLAIM_FAKE,
    reserved: { kind: "fakeToken", pattern: "^TEST_Text_\\d{6}$" },
  },
];

const BY_FIELD = new Map<FieldType, CatalogEntry>(CATALOG.map((e) => [e.field, e]));

/** Look up the catalog entry for a field type. Throws if the field is unknown. */
export function getEntry(field: FieldType): CatalogEntry {
  const entry = BY_FIELD.get(field);
  if (entry === undefined) throw new Error(`No catalog entry for field type: ${field}`);
  return entry;
}

function domainIsReserved(domain: string, domains: readonly string[], tlds: readonly string[]): boolean {
  const d = domain.toLowerCase();
  if (domains.includes(d)) return true;
  return tlds.some((t) => d === t || d.endsWith(`.${t}`));
}

/**
 * Is `value` inside the reserved range declared for `entry`? This is the single
 * predicate behind both `verify` (is generated output still in range?) and `scan`
 * (does existing data contain anything *out* of range, i.e. candidate real PII?).
 */
export function isReserved(entry: CatalogEntry, value: string): boolean {
  const r = entry.reserved;
  switch (r.kind) {
    case "emailDomains": {
      const at = value.lastIndexOf("@");
      if (at < 0) return false;
      return domainIsReserved(value.slice(at + 1), r.domains, r.reservedTlds);
    }
    case "domains":
      return domainIsReserved(value, r.domains, r.reservedTlds);
    case "ipv4Blocks":
      return r.cidrs.some((c) => ipv4InCidr(value, c));
    case "ipv6Blocks":
      return r.cidrs.some((c) => ipv6InPrefix(value, c));
    case "phoneBlock": {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 7) return false;
      const last7 = digits.slice(-7);
      const nxx = last7.slice(0, 3);
      const line = Number(last7.slice(3));
      return nxx === r.centralOfficeCode && line >= r.subscriberStart && line <= r.subscriberEnd;
    }
    case "ssnInvalid": {
      const digits = value.replace(/\D/g, "");
      if (digits.length !== 9) return false;
      const area = digits.slice(0, 3);
      const group = digits.slice(3, 5);
      const serial = digits.slice(5);
      const areaNum = Number(area);
      const areaInvalid =
        r.invalidAreas.includes(area) || (areaNum >= r.invalidAreaMin && areaNum <= r.invalidAreaMax);
      return areaInvalid || group === r.invalidGroup || serial === r.invalidSerial;
    }
    case "cardTestNumbers": {
      const digits = value.replace(/\D/g, "");
      return r.numbers.some((n) => n.replace(/\D/g, "") === digits);
    }
    case "fakeToken":
      return new RegExp(r.pattern).test(value);
  }
}

/**
 * Heuristic used to assert the structurally-fake tier really is self-evident:
 * a human glancing at the value should see "test data", not a plausible person.
 */
export function isSelfEvidentlyFake(value: string): boolean {
  return /test[_\s]/i.test(value) || /\bexample\b/i.test(value);
}
