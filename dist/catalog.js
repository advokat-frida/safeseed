import { ipv4InCidr, ipv6InPrefix } from "./net.js";
// 2.0.0: the ssn reserved range narrowed to exclude areas 900-999 (the IRS ITIN
// space — real identifiers). SafeSeed 0.3 rejects older record contracts and asks
// for regeneration rather than trusting stale catalog metadata.
// 3.0.0: ranges are unchanged; tier names and claims were narrowed so the catalog
// states what reserves/designates a value without claiming coincidence is impossible.
export const CATALOG_VERSION = "3.0.0";
// Tier-appropriate claim language deliberately avoids proof, impossibility, and
// lifetime-policy language on every tier. The catalog describes the constraint it
// can support; it does not infer that a generated string can never coincide with a
// real party or be handled by infrastructure.
const CLAIM_PROTOCOL_RESERVED = "Inside a namespace reserved by a published protocol for documentation or testing. The reservation is the claim; it does not prove that no infrastructure could ever handle the value.";
const CLAIM_AUTHORITY_RESERVED = "Inside a range or invalid pattern the cited issuing authority currently designates for fictitious use or excludes from ordinary issuance. This administrative-policy claim must be revalidated when the catalog changes.";
const CLAIM_DESIGNATED = "Published for processor or sandbox testing and intended for test mode. It passes checksum validation; the test designation, not mathematical impossibility, supports the claim.";
const CLAIM_FAKE = "Structurally synthetic token; not derived from any real record. This field type is not reserved by any standard, so realism is deliberately avoided.";
const RFC2606_DOMAINS = ["example.com", "example.net", "example.org"];
const RFC2606_TLDS = ["test", "example", "invalid", "localhost"];
const RFC5737_BLOCKS = ["192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24"];
const RFC3849_BLOCKS = ["2001:db8::/32"];
/** Payment-processor / sandbox test PANs (all Luhn-valid by design). */
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
];
export const CATALOG = [
    {
        field: "email",
        tier: "protocol-reserved",
        citation: "RFC 2606 §2–3 (reserved example.com/.net/.org and TLDs .test/.example/.invalid/.localhost)",
        description: "Email-shaped values under an RFC 2606 reserved example domain or TLD; reserved for documentation and testing rather than customer production use.",
        claim: CLAIM_PROTOCOL_RESERVED,
        reserved: { kind: "emailDomains", domains: RFC2606_DOMAINS, reservedTlds: RFC2606_TLDS },
    },
    {
        field: "domain",
        tier: "protocol-reserved",
        citation: "RFC 2606 §2–3 (reserved domains and TLDs)",
        description: "Hostnames under an RFC 2606 reserved domain or TLD.",
        claim: CLAIM_PROTOCOL_RESERVED,
        reserved: { kind: "domains", domains: RFC2606_DOMAINS, reservedTlds: RFC2606_TLDS },
    },
    {
        field: "ipv4",
        tier: "protocol-reserved",
        citation: "RFC 5737 (IPv4 documentation blocks TEST-NET-1/2/3)",
        description: "IPv4 addresses inside the three RFC 5737 documentation ranges, which per the RFC should not be routed on the public Internet.",
        claim: CLAIM_PROTOCOL_RESERVED,
        reserved: { kind: "ipv4Blocks", cidrs: RFC5737_BLOCKS },
    },
    {
        field: "ipv6",
        tier: "protocol-reserved",
        citation: "RFC 3849 (IPv6 documentation prefix 2001:db8::/32)",
        description: "IPv6 addresses inside the RFC 3849 documentation prefix.",
        claim: CLAIM_PROTOCOL_RESERVED,
        reserved: { kind: "ipv6Blocks", cidrs: RFC3849_BLOCKS },
    },
    {
        field: "phone",
        tier: "authority-reserved",
        citation: "NANPA / ATIS fictitious-number assignment (555-0100 through 555-0199)",
        description: "North American numbers in the 555-01xx subscriber block the numbering authority designates for fictitious, non-working use (administrative policy, not a protocol limit).",
        claim: CLAIM_AUTHORITY_RESERVED,
        reserved: { kind: "phoneBlock", centralOfficeCode: "555", subscriberStart: 100, subscriberEnd: 199 },
    },
    {
        field: "ssn",
        tier: "authority-reserved",
        citation: "SSA SSN randomization (effective 2011-06-25): never-assigned area 000 / 666, group 00, serial 0000 (ssa.gov/employer/randomization.html). Areas 900-999 are deliberately excluded: that is the IRS ITIN space (9XX-XX-XXXX), which contains real, issued identifiers.",
        description: "US SSN-shaped values containing a component the SSA identifies as invalid for SSNs: area 000 or 666, group 00, or serial 0000. Areas 900-999 are excluded because they overlap the real IRS ITIN space. A validator that encodes SSA issuance rules should reject these values.",
        claim: CLAIM_AUTHORITY_RESERVED,
        reserved: {
            kind: "ssnInvalid",
            invalidAreas: ["000", "666"],
            invalidGroup: "00",
            invalidSerial: "0000",
        },
    },
    {
        field: "creditCard",
        tier: "designated-test-only",
        citation: "Payment-processor / sandbox test PANs (e.g. Stripe testing docs); intended for test mode",
        description: "Card numbers processors and sandboxes publish for testing. They pass the Luhn checksum; their test designation is the assurance source, not mathematical impossibility.",
        claim: CLAIM_DESIGNATED,
        reserved: { kind: "cardTestNumbers", numbers: CARD_TEST_NUMBERS },
    },
    {
        field: "firstName",
        tier: "structurally-fake",
        citation: "No standard reserves names; structurally-fake token convention",
        description: "Given names rendered as obvious TEST_ tokens rather than plausible names.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_Firstname_\\d{6,}$" },
    },
    {
        field: "lastName",
        tier: "structurally-fake",
        citation: "No standard reserves names; structurally-fake token convention",
        description: "Family names rendered as obvious TEST_ tokens.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_Lastname_\\d{6,}$" },
    },
    {
        field: "fullName",
        tier: "structurally-fake",
        citation: "No standard reserves names; structurally-fake token convention",
        description: "Full names rendered as obvious TEST_ tokens.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_Person_\\d{6,}$" },
    },
    {
        field: "streetAddress",
        tier: "structurally-fake",
        citation: "No standard reserves addresses; structurally-fake 'Example' convention",
        description: "Street addresses built on the obvious 'Example' street name.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^\\d+ Example (Way|St|Ave|Rd|Blvd)$" },
    },
    {
        field: "freeText",
        tier: "structurally-fake",
        citation: "No standard reserves free text; structurally-fake token convention",
        description: "Free-text fields rendered as obvious TEST_ tokens.",
        claim: CLAIM_FAKE,
        reserved: { kind: "fakeToken", pattern: "^TEST_Text_\\d{6,}$" },
    },
];
const BY_FIELD = new Map(CATALOG.map((e) => [e.field, e]));
/** Look up the catalog entry for a field type. Throws if the field is unknown. */
export function getEntry(field) {
    const entry = BY_FIELD.get(field);
    if (entry === undefined)
        throw new Error(`No catalog entry for field type: ${field}`);
    return entry;
}
function domainIsReserved(domain, domains, tlds) {
    const d = domain.toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(d) || d.startsWith(".") || d.endsWith(".") || d.includes("..")) {
        return false;
    }
    // RFC 2606 reserves the whole zone of a reserved second-level domain, so a
    // subdomain (mail.example.com) is reserved too — not just the bare domain.
    if (domains.some((rd) => d === rd || d.endsWith(`.${rd}`)))
        return true;
    return tlds.some((t) => d === t || d.endsWith(`.${t}`));
}
/**
 * Is `value` inside the reserved range declared for `entry`? This is the single
 * predicate behind both `verify` (is generated output still in range?) and `scan`
 * (does existing data contain anything *out* of range, i.e. candidate real PII?).
 */
export function isReserved(entry, value) {
    const r = entry.reserved;
    switch (r.kind) {
        case "emailDomains": {
            // This catalog supports one simple mailbox-shaped value per cell. Reject
            // whitespace, controls, and multiple addresses instead of extracting a safe
            // suffix from a composite value that may also contain real PII.
            if (!/^[^\s@]+@[^\s@]+$/.test(value))
                return false;
            const parts = value.split("@");
            if (parts.length !== 2 || parts[0] === "" || parts[1] === "")
                return false;
            const domain = parts[1];
            return domain !== undefined && domainIsReserved(domain, r.domains, r.reservedTlds);
        }
        case "domains":
            return domainIsReserved(value, r.domains, r.reservedTlds);
        case "ipv4Blocks":
            return r.cidrs.some((c) => ipv4InCidr(value, c));
        case "ipv6Blocks":
            if (value.trim() !== value || value.includes("%"))
                return false;
            return r.cidrs.some((c) => ipv6InPrefix(value, c));
        case "phoneBlock": {
            // Supported shapes are the generated 7-digit form and a 10-digit NANPA
            // number, with ordinary phone punctuation only. Never strip arbitrary text
            // and inspect a safe-looking suffix of a composite cell.
            if (!/^[0-9()+. -]+$/.test(value))
                return false;
            const digits = value.replace(/\D/g, "");
            if (digits.length !== 7 && digits.length !== 10)
                return false;
            const last7 = digits.slice(-7);
            const nxx = last7.slice(0, 3);
            const line = Number(last7.slice(3));
            return nxx === r.centralOfficeCode && line >= r.subscriberStart && line <= r.subscriberEnd;
        }
        case "ssnInvalid": {
            // The value contains a component the SSA identifies as invalid for SSNs.
            // Deliberately excluded: areas 900-999, which overlap the real ITIN space;
            // catalog 2.0.0 removed them.
            if (!/^(?:\d{9}|\d{3}-\d{2}-\d{4})$/.test(value))
                return false;
            const digits = value.replaceAll("-", "");
            const area = digits.slice(0, 3);
            const group = digits.slice(3, 5);
            const serial = digits.slice(5);
            // The entire 9xx area is excluded even when another component is invalid:
            // it is the IRS ITIN namespace, and a real identifier must never become
            // "reserved" merely because its group/serial resembles an SSA-invalid SSN.
            if (Number(area) >= 900)
                return false;
            return r.invalidAreas.includes(area) || group === r.invalidGroup || serial === r.invalidSerial;
        }
        case "cardTestNumbers": {
            if (!/^[0-9 -]+$/.test(value))
                return false;
            const digits = value.replace(/[ -]/g, "");
            return r.numbers.some((n) => n.replace(/[ -]/g, "") === digits);
        }
        case "fakeToken":
            return new RegExp(r.pattern).test(value);
    }
}
/**
 * Heuristic used to assert the structurally-fake tier really is self-evident:
 * a human glancing at the value should see "test data", not a plausible person.
 */
export function isSelfEvidentlyFake(value) {
    return /test[_\s]/i.test(value) || /\bexample\b/i.test(value);
}
//# sourceMappingURL=catalog.js.map