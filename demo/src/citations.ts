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
      "example.com / .net / .org and the .test / .example / .invalid / .localhost names are reserved for documentation and testing. The reservation prevents ordinary customer registration; it is not a claim that infrastructure can never handle a value under them.",
    url: "https://datatracker.ietf.org/doc/html/rfc2606",
  },
  sha256Email: {
    short: "SHA-256 · RFC input",
    standard: "Google Ads SHA-256 format over an RFC 2606-reserved email input",
    reserves:
      "SafeSeed publishes a fixed allowlist of lowercase SHA-256 digests whose known inputs use example.com. The input domain is reserved; the digest itself is not reserved or visibly distinguishable from a hash of customer data.",
    url: "https://support.google.com/google-ads/answer/13262500",
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
  ukPhone: {
    short: "Ofcom drama",
    standard: "Ofcom telephone numbers for TV and radio drama",
    reserves:
      "The UK mobile block 07700 900000 through 07700 900999 is recommended for drama and is not allocated to providers in the foreseeable future.",
    url: "https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama",
  },
  sha256Phone: {
    short: "SHA-256 · NANPA input",
    standard: "Google Ads SHA-256 format over a NANPA fictitious phone input",
    reserves:
      "SafeSeed publishes a fixed allowlist of lowercase SHA-256 digests whose known E.164 inputs sit in the 555-0100 through 555-0199 fictitious block. The input policy is the assurance source; the digest itself is not reserved.",
    url: "https://support.google.com/google-ads/answer/13262500",
  },
  ssn: {
    short: "SSA",
    standard: "SSA SSN randomization (since 2011-06-25)",
    reserves:
      "Components neither the SSA (SSNs) nor the IRS (ITINs) ever issues: area 000 or 666, group 00, serial 0000. Reserved by the issuing authorities' own rules rather than by protocol. Areas 900-999 are deliberately NOT used — that is the IRS ITIN space (9XX-XX-XXXX), which holds real, issued taxpayer identifiers.",
    url: "https://www.ssa.gov/employer/randomization.html",
  },
  creditCard: {
    short: "Test PAN",
    standard: "Payment-processor / sandbox test PANs",
    reserves:
      "Numbers processors publish for testing (e.g. 4242 4242 4242 4242). They pass the Luhn checksum and are intended for test mode — assurance by designation, not impossibility.",
    url: "https://docs.stripe.com/testing",
  },
  marketingUrl: {
    short: "RFC 2606 + TEST_",
    standard: "Reserved example host with SafeSeed-constrained UTM parameters",
    reserves:
      "The host is campaign.example.com and every accepted URL carries the exact landing path and three obvious TEST_ attribution parameters. A reserved host alone does not make arbitrary query data safe.",
    url: "https://datatracker.ietf.org/doc/html/rfc2606",
  },
  opaqueId: {
    short: "Structurally fake",
    standard: "No standard reserves business or cookie identifiers",
    reserves:
      "SafeSeed uses cookie-safe TEST_ tokens that include the normalized column name. Arbitrary UUIDs, click IDs, cookie IDs, and other opaque strings are not accepted merely because their format looks plausible.",
    url: "",
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
