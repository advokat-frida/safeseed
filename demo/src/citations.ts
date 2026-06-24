import type { FieldType } from "safeseed";

export interface CitationDetail {
  /** Short chip label, e.g. "RFC 2606". */
  short: string;
  /** Full standard name. */
  standard: string;
  /** What it reserves, stated factually (no fabricated quotes). */
  reserves: string;
  /** Canonical source URL (empty for the structurally-fake tier). */
  url: string;
}

// Citation detail surfaced in the demo's provenance chips/cards. Kept factual and
// paraphrased — no invented "literal quotes" from the standards. The tier and the
// one-line citation come from the core catalog itself (getEntry().citation); this
// adds the human-facing range detail + canonical link.
export const CITATIONS: Record<FieldType, CitationDetail> = {
  email: {
    short: "RFC 2606",
    standard: "RFC 2606 — Reserved Top Level DNS Names",
    reserves:
      "example.com / .net / .org and the .test / .example / .invalid / .localhost TLDs. These names are permanently reserved and can never be registered by anyone, so no address under them can belong to a real party — active or dormant.",
    url: "https://datatracker.ietf.org/doc/html/rfc2606",
  },
  domain: {
    short: "RFC 2606",
    standard: "RFC 2606 — Reserved Top Level DNS Names",
    reserves: "example.com / .net / .org and the .test / .example / .invalid / .localhost TLDs.",
    url: "https://datatracker.ietf.org/doc/html/rfc2606",
  },
  ipv4: {
    short: "RFC 5737",
    standard: "RFC 5737 — IPv4 Blocks Reserved for Documentation",
    reserves:
      "192.0.2.0/24 (TEST-NET-1), 198.51.100.0/24 (TEST-NET-2), 203.0.113.0/24 (TEST-NET-3). Per RFC 5737, they should not appear on the public Internet.",
    url: "https://www.rfc-editor.org/rfc/rfc5737.html",
  },
  ipv6: {
    short: "RFC 3849",
    standard: "RFC 3849 — IPv6 Prefix Reserved for Documentation",
    reserves: "2001:db8::/32, reserved for documentation and examples.",
    url: "https://www.rfc-editor.org/rfc/rfc3849.html",
  },
  phone: {
    short: "NANPA",
    standard: "NANPA fictitious-number assignment",
    reserves: "555-0100 through 555-0199 — the block designated for fictitious use.",
    url: "https://www.nanpa.com/",
  },
  ssn: {
    short: "SSA",
    standard: "SSA SSN randomization (since 2011-06-25)",
    reserves:
      "Areas the SSA does not issue (000, 666, 900-999), plus group 00 and serial 0000. Reserved by the issuing authority's own rules rather than by protocol, so no valid SSN is ever assigned from them.",
    url: "https://www.ssa.gov/employer/randomization.html",
  },
  creditCard: {
    short: "Test PAN",
    standard: "Payment-processor / sandbox test PANs",
    reserves:
      "Numbers processors publish for testing (e.g. 4242 4242 4242 4242). They pass the Luhn checksum but authorize nowhere — non-real by designation, not impossibility.",
    url: "https://docs.stripe.com/testing",
  },
  firstName: SELF_EVIDENT(),
  lastName: SELF_EVIDENT(),
  fullName: SELF_EVIDENT(),
  streetAddress: {
    short: "Structurally fake",
    standard: "No standard reserves addresses",
    reserves:
      "No standards body reserves fake addresses, so these are built on the obvious 'Example' street name rather than a plausible-but-random address.",
    url: "",
  },
  freeText: SELF_EVIDENT(),
};

function SELF_EVIDENT(): CitationDetail {
  return {
    short: "Structurally fake",
    standard: "No standard reserves names",
    reserves:
      "No standards body reserves fake names, so these are made structurally fake (obvious TEST_ tokens) rather than plausible — because a random 'real-looking' name can coincidentally match a living person.",
    url: "",
  };
}
