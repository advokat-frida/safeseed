/**
 * The reserved-range catalog — SafeSeed's reusable core IP.
 *
 * Each entry maps a PII-shaped field type to a bounded test-data space, the source
 * for that constraint, its assurance tier, and the exact language allowed about
 * it. Generation, verification, and scanning all read from this one table, which
 * is what makes the promise auditable: review this
 * versioned catalog before release and whenever its sources change, then bind
 * each output to the catalog version and its tier-appropriate claims.
 *
 * Sourcing: the RFC 2606 / 5737 / 3849 reservations are confirmed against primary
 * sources. The SSN-shaped space uses components the SSA identifies as invalid
 * for SSNs: area 000, area 666, group 00, or serial 0000. The 900-999 area range
 * is deliberately NOT treated as reserved because it overlaps the IRS ITIN space
 * (9XX-XX-XXXX), which contains real, issued taxpayer identifiers, and the IRS has
 * expanded its ITIN group ranges over time.
 * The NANPA 555-0100..0199 fictitious block is well-established; its shipped
 * citation link is the NANPA homepage rather than a deep rule page.
 */
import type { FieldType, Tier } from "./types.js";
export declare const CATALOG_VERSION = "4.0.0";
/** Inspectable, structured definition of a reserved space. Drives generation,
 * verification, and scanning, and lets tests assert the ranges match standards. */
export type ReservedSpec = {
    kind: "emailDomains";
    domains: readonly string[];
    reservedTlds: readonly string[];
} | {
    kind: "domains";
    domains: readonly string[];
    reservedTlds: readonly string[];
} | {
    kind: "ipv4Blocks";
    cidrs: readonly string[];
} | {
    kind: "ipv6Blocks";
    cidrs: readonly string[];
} | {
    kind: "phoneBlock";
    centralOfficeCode: string;
    subscriberStart: number;
    subscriberEnd: number;
} | {
    kind: "ssnInvalid";
    /** Areas never issued by the SSA and structurally outside the IRS ITIN space (000, 666). */
    invalidAreas: readonly string[];
    invalidGroup: string;
    invalidSerial: string;
} | {
    kind: "cardTestNumbers";
    numbers: readonly string[];
} | {
    kind: "ukDramaPhoneBlock";
    nationalPrefix: string;
    subscriberStart: number;
    subscriberEnd: number;
} | {
    kind: "sha256Allowlist";
    inputType: "email" | "phone";
    values: readonly {
        source: string;
        digest: string;
    }[];
} | {
    kind: "marketingUrl";
    baseUrl: string;
    params: readonly {
        name: string;
        tokenPrefix: string;
    }[];
} | {
    kind: "fakeToken";
    pattern: string;
};
export interface CatalogEntry {
    field: FieldType;
    tier: Tier;
    /** Human-readable citation for the reservation. */
    citation: string;
    /** What the reserved space is, in plain words. */
    description: string;
    /** Tier-appropriate, non-overclaiming statement about values of this field. */
    claim: string;
    /**
     * Exact transformation applied after the cited source constraint. When present,
     * the tier describes the input's assurance basis; the transformed value is not
     * itself claimed to occupy that reserved namespace.
     */
    derivation?: string;
    reserved: ReservedSpec;
}
export declare const CATALOG: readonly CatalogEntry[];
/** Look up the catalog entry for a field type. Throws if the field is unknown. */
export declare function getEntry(field: FieldType): CatalogEntry;
/**
 * Is `value` inside the reserved range declared for `entry`? This is the single
 * predicate behind both `verify` (is generated output still in range?) and `scan`
 * (does existing data contain anything *out* of range, i.e. candidate real PII?).
 */
export declare function isReserved(entry: CatalogEntry, value: string): boolean;
/**
 * Heuristic used to assert the structurally-fake tier really is self-evident:
 * a human glancing at the value should see "test data", not a plausible person.
 */
export declare function isSelfEvidentlyFake(value: string): boolean;
//# sourceMappingURL=catalog.d.ts.map