import { describe, it, expect } from "vitest";
import {
  CATALOG,
  CATALOG_VERSION,
  getEntry,
  isReserved,
  isSelfEvidentlyFake,
} from "./catalog.js";
import { luhnValid } from "./luhn.js";
import { sha256Hex } from "./hash.js";
import type { Tier } from "./types.js";

const TIERS: Tier[] = [
  "protocol-reserved",
  "authority-reserved",
  "designated-test-only",
  "structurally-fake",
];

describe("catalog.everyFieldHasCitationAndTier", () => {
  it("has a versioned, non-empty catalog", () => {
    expect(CATALOG.length).toBeGreaterThan(0);
    expect(CATALOG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("every entry has a citation, description, claim, and a valid tier", () => {
    for (const entry of CATALOG) {
      expect(entry.citation.trim().length, entry.field).toBeGreaterThan(0);
      expect(entry.description.trim().length, entry.field).toBeGreaterThan(0);
      expect(entry.claim.trim().length, entry.field).toBeGreaterThan(0);
      expect(TIERS, entry.field).toContain(entry.tier);
    }
  });

  it("field types are unique", () => {
    const fields = CATALOG.map((e) => e.field);
    expect(new Set(fields).size).toBe(fields.length);
  });
});

describe("catalog.tierTaxonomyReflectsReality", () => {
  it("keeps direct RFC reservations distinct from derived digests", () => {
    const protocolReserved = CATALOG.filter(
      (e) => e.tier === "protocol-reserved" && e.derivation === undefined,
    )
      .map((e) => e.field)
      .sort();
    expect(protocolReserved).toEqual(["domain", "email", "ipv4", "ipv6"].sort());
    expect(getEntry("sha256Email").tier).toBe("protocol-reserved");
    expect(getEntry("sha256Email").derivation).toMatch(/SHA-256/i);
  });

  it("authority-designated phone and identity ranges remain authority-reserved", () => {
    expect(getEntry("phone").tier).toBe("authority-reserved");
    expect(getEntry("ukPhone").tier).toBe("authority-reserved");
    expect(getEntry("sha256Phone").tier).toBe("authority-reserved");
    expect(getEntry("sha256Phone").derivation).toMatch(/SHA-256/i);
    expect(getEntry("ssn").tier).toBe("authority-reserved");
  });

  it("every tier claim avoids absolute impossibility and lifetime-policy language", () => {
    const banned = [
      /cannot be (a )?real/i,
      /cannot correspond/i,
      /\bimpossible/i,
      /\bguarantee/i,
      /\bpermanent(?:ly)?\b/i,
      /\bnever assigned\b/i,
    ];
    for (const e of CATALOG) {
      for (const re of banned) {
        expect(re.test(e.claim), `${e.field} claim overclaims: "${e.claim}"`).toBe(false);
      }
    }
  });
});

describe("catalog.reservedRangesMatchStandards", () => {
  it("email reserves the RFC 2606 domains and TLDs", () => {
    const e = getEntry("email");
    expect(e.tier).toBe("protocol-reserved");
    expect(e.reserved.kind).toBe("emailDomains");
    if (e.reserved.kind === "emailDomains") {
      expect(e.reserved.domains).toEqual(
        expect.arrayContaining(["example.com", "example.net", "example.org"]),
      );
      expect(e.reserved.reservedTlds).toEqual(
        expect.arrayContaining(["invalid", "example", "test", "localhost"]),
      );
    }
    expect(isReserved(e, "alice@example.com")).toBe(true);
    expect(isReserved(e, "bob@host.invalid")).toBe(true);
    expect(isReserved(e, "carol@gmail.com")).toBe(false);
    expect(isReserved(e, "not-an-email")).toBe(false);
    expect(isReserved(e, "real.person@gmail.com plus fake@example.com")).toBe(false);
    expect(isReserved(e, "real.person@gmail.com\nfake@example.com")).toBe(false);
  });

  it("ipv4 reserves exactly the three RFC 5737 documentation blocks", () => {
    const e = getEntry("ipv4");
    if (e.reserved.kind === "ipv4Blocks") {
      expect(e.reserved.cidrs).toEqual(
        expect.arrayContaining([
          "192.0.2.0/24",
          "198.51.100.0/24",
          "203.0.113.0/24",
        ]),
      );
    }
    expect(isReserved(e, "192.0.2.55")).toBe(true);
    expect(isReserved(e, "198.51.100.1")).toBe(true);
    expect(isReserved(e, "203.0.113.254")).toBe(true);
    expect(isReserved(e, "8.8.8.8")).toBe(false);
    expect(isReserved(e, "192.0.3.1")).toBe(false);
  });

  it("ipv6 reserves the RFC 3849 documentation prefix", () => {
    const e = getEntry("ipv6");
    if (e.reserved.kind === "ipv6Blocks") {
      expect(e.reserved.cidrs).toContain("2001:db8::/32");
    }
    expect(isReserved(e, "2001:db8::1")).toBe(true);
    expect(isReserved(e, "2001:db8:dead:beef::cafe")).toBe(true);
    expect(isReserved(e, "2001:4860:4860::8888")).toBe(false);
    expect(isReserved(e, "2001:db8::1%real.person@gmail.com")).toBe(false);
    expect(isReserved(e, "2001:db8::1%foo\n8.8.8.8")).toBe(false);
  });

  it("phone reserves the NANPA 555-0100..0199 fictitious block", () => {
    const e = getEntry("phone");
    if (e.reserved.kind === "phoneBlock") {
      expect(e.reserved.centralOfficeCode).toBe("555");
      expect(e.reserved.subscriberStart).toBe(100);
      expect(e.reserved.subscriberEnd).toBe(199);
    }
    expect(isReserved(e, "(800) 555-0142")).toBe(true);
    expect(isReserved(e, "212-555-0199")).toBe(true);
    expect(isReserved(e, "212-555-0200")).toBe(false);
    expect(isReserved(e, "212-867-5309")).toBe(false);
    expect(isReserved(e, "(212) 867-5309 / (800) 555-0100")).toBe(false);
  });

  it("UK phones stay inside Ofcom's 07700 900000..900999 drama block", () => {
    const e = getEntry("ukPhone");
    expect(e.reserved.kind).toBe("ukDramaPhoneBlock");
    expect(isReserved(e, "07700 900000")).toBe(true);
    expect(isReserved(e, "+447700900999")).toBe(true);
    expect(isReserved(e, "07700 899999")).toBe(false);
    expect(isReserved(e, "+447700901000")).toBe(false);
    expect(isReserved(e, "Call +447700900123 or +447700900124")).toBe(false);
  });

  it("hashed marketing identifiers accept only published digests of constrained inputs", async () => {
    const email = getEntry("sha256Email");
    const phone = getEntry("sha256Phone");
    expect(email.reserved.kind).toBe("sha256Allowlist");
    expect(phone.reserved.kind).toBe("sha256Allowlist");
    if (email.reserved.kind === "sha256Allowlist") {
      for (const candidate of email.reserved.values) {
        expect(isReserved(getEntry("email"), candidate.source), candidate.source).toBe(true);
        expect(candidate.digest).toBe(await sha256Hex(candidate.source));
        expect(isReserved(email, candidate.digest)).toBe(true);
      }
    }
    if (phone.reserved.kind === "sha256Allowlist") {
      for (const candidate of phone.reserved.values) {
        expect(isReserved(getEntry("phone"), candidate.source.slice(2)), candidate.source).toBe(true);
        expect(candidate.digest).toBe(await sha256Hex(candidate.source));
        expect(isReserved(phone, candidate.digest)).toBe(true);
      }
    }
    expect(isReserved(email, "a".repeat(64))).toBe(false);
    expect(isReserved(phone, "0".repeat(64))).toBe(false);
  });

  it("marketing URLs constrain the host, path, parameter set, order, and TEST values", () => {
    const e = getEntry("marketingUrl");
    const safe = "https://campaign.example.com/landing?utm_source=TEST_SOURCE_000001&utm_medium=TEST_MEDIUM_000001&utm_campaign=TEST_CAMPAIGN_000001";
    expect(isReserved(e, safe)).toBe(true);
    expect(isReserved(e, safe.replace("campaign.example.com", "customer.example"))).toBe(false);
    expect(isReserved(e, safe.replace("TEST_CAMPAIGN_000001", "spring-sale"))).toBe(false);
    expect(isReserved(e, `${safe}&email=real.person@gmail.com`)).toBe(false);
    expect(isReserved(e, safe.replace("utm_source", "utm_campaign"))).toBe(false);
    expect(isReserved(e, safe.replace("TEST_SOURCE", "%54EST_SOURCE"))).toBe(false);
  });

  it("opaque IDs are visibly fake and remain valid cookie-value characters", () => {
    const e = getEntry("opaqueId");
    const value = "TEST_COOKIE_ID_000001";
    expect(isReserved(e, value)).toBe(true);
    expect(isSelfEvidentlyFake(value)).toBe(true);
    expect(/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/.test(value)).toBe(true);
    expect(isReserved(e, "3f6f1e5a-actual-looking-id")).toBe(false);
  });

  it("ssn reserves only components never issued by BOTH the SSA and the IRS ITIN scheme", () => {
    const e = getEntry("ssn");
    if (e.reserved.kind === "ssnInvalid") {
      expect(e.reserved.invalidAreas).toEqual(["000", "666"]);
      expect(e.reserved.invalidGroup).toBe("00");
      expect(e.reserved.invalidSerial).toBe("0000");
      // The 900-999 area block must NOT be part of the reserved spec: it is the
      // IRS ITIN space, which contains real, issued identifiers.
      expect("invalidAreaMin" in e.reserved).toBe(false);
      expect("invalidAreaMax" in e.reserved).toBe(false);
    }
    expect(isReserved(e, "000-12-3456")).toBe(true);
    expect(isReserved(e, "666-12-3456")).toBe(true);
    expect(isReserved(e, "123-00-6789")).toBe(true); // never-issued group
    expect(isReserved(e, "123-45-0000")).toBe(true); // never-issued serial
    expect(isReserved(e, "123-45-6789")).toBe(false); // plausibly real SSN
    // 9xx areas are candidate REAL data now (ITIN space), not reserved:
    expect(isReserved(e, "900-12-3456")).toBe(false);
    expect(isReserved(e, "999-43-3811")).toBe(false);
    expect(isReserved(e, "900-00-1234")).toBe(false);
    expect(isReserved(e, "900-70-0000")).toBe(false);
    expect(isReserved(e, "999-94-0000")).toBe(false);
    expect(isReserved(e, "SSN 123-00-6789")).toBe(false);
    expect(isReserved(e, "123-45-6789 / 123-00-6789")).toBe(false);
  });

  it("credit card numbers are designated-test-only and Luhn-valid", () => {
    const e = getEntry("creditCard");
    expect(e.tier).toBe("designated-test-only");
    if (e.reserved.kind === "cardTestNumbers") {
      expect(e.reserved.numbers.length).toBeGreaterThan(0);
      for (const n of e.reserved.numbers) {
        expect(luhnValid(n.replace(/\D/g, "")), n).toBe(true);
      }
    }
    expect(isReserved(e, "4242 4242 4242 4242")).toBe(true);
    expect(isReserved(e, "4111111111111111")).toBe(true);
    expect(isReserved(e, "1234567890123456")).toBe(false);
    expect(isReserved(e, "real 1234567890123456 / 4242424242424242")).toBe(false);
  });

  it("structurally-fake fields are recognized as self-evidently fake", () => {
    for (const field of ["opaqueId", "marketingUrl", "firstName", "lastName", "fullName", "streetAddress", "freeText"] as const) {
      expect(getEntry(field).tier).toBe("structurally-fake");
    }
    expect(isSelfEvidentlyFake("TEST_Lastname_000142")).toBe(true);
    expect(isSelfEvidentlyFake("123 Example Way")).toBe(true);
    expect(isSelfEvidentlyFake("Jonathan Smith")).toBe(false);
  });
});
