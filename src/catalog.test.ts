import { describe, it, expect } from "vitest";
import {
  CATALOG,
  CATALOG_VERSION,
  getEntry,
  isReserved,
  isSelfEvidentlyFake,
} from "./catalog.js";
import { luhnValid } from "./luhn.js";
import type { Tier } from "./types.js";

const TIERS: Tier[] = [
  "provably-non-real",
  "reserved-not-issued",
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
  it("only protocol/standard-reserved fields are provably-non-real", () => {
    const provable = CATALOG.filter((e) => e.tier === "provably-non-real")
      .map((e) => e.field)
      .sort();
    expect(provable).toEqual(["domain", "email", "ipv4", "ipv6"].sort());
  });

  it("authority-reserved fields (NANPA phones, SSA SSNs) are reserved-not-issued, not provably-non-real", () => {
    expect(getEntry("phone").tier).toBe("reserved-not-issued");
    expect(getEntry("ssn").tier).toBe("reserved-not-issued");
  });

  it("reserved-not-issued claims avoid protocol-impossibility / proof language", () => {
    const banned = [
      /\bproof\b/i,
      /\bproven\b/i,
      /cannot be (a )?real/i,
      /cannot correspond/i,
      /\bimpossible/i,
      /\bguarantee/i,
    ];
    const reserved = CATALOG.filter((e) => e.tier === "reserved-not-issued");
    expect(reserved.length).toBeGreaterThan(0);
    for (const e of reserved) {
      for (const re of banned) {
        expect(re.test(e.claim), `${e.field} claim overclaims: "${e.claim}"`).toBe(false);
      }
    }
  });
});

describe("catalog.reservedRangesMatchStandards", () => {
  it("email reserves the RFC 2606 domains and TLDs", () => {
    const e = getEntry("email");
    expect(e.tier).toBe("provably-non-real");
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
  });

  it("ssn reserves unassigned area/group/serial ranges", () => {
    const e = getEntry("ssn");
    if (e.reserved.kind === "ssnInvalid") {
      expect(e.reserved.invalidAreas).toEqual(
        expect.arrayContaining(["000", "666"]),
      );
      expect(e.reserved.invalidAreaMin).toBe(900);
      expect(e.reserved.invalidAreaMax).toBe(999);
    }
    expect(isReserved(e, "900-12-3456")).toBe(true);
    expect(isReserved(e, "000-12-3456")).toBe(true);
    expect(isReserved(e, "666-12-3456")).toBe(true);
    expect(isReserved(e, "123-00-6789")).toBe(true); // invalid group
    expect(isReserved(e, "123-45-0000")).toBe(true); // invalid serial
    expect(isReserved(e, "123-45-6789")).toBe(false); // plausibly real
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
  });

  it("structurally-fake fields are recognized as self-evidently fake", () => {
    for (const field of ["firstName", "lastName", "fullName", "streetAddress", "freeText"] as const) {
      expect(getEntry(field).tier).toBe("structurally-fake");
    }
    expect(isSelfEvidentlyFake("TEST_Lastname_000142")).toBe(true);
    expect(isSelfEvidentlyFake("123 Example Way")).toBe(true);
    expect(isSelfEvidentlyFake("Jonathan Smith")).toBe(false);
  });
});
