import { describe, it, expect } from "vitest";
import { getEntry, isReserved } from "./catalog.js";

describe("catalog.reservedZonesCoverSubdomains", () => {
  it("treats subdomains of an RFC 2606 reserved domain as reserved", () => {
    const email = getEntry("email");
    expect(isReserved(email, "user@mail.example.com")).toBe(true);
    expect(isReserved(email, "user@a.b.example.org")).toBe(true);
    const domain = getEntry("domain");
    expect(isReserved(domain, "deep.sub.example.net")).toBe(true);
    // a domain that merely ends with the string "example.com" but isn't in the zone
    expect(isReserved(email, "user@notexample.com")).toBe(false);
    expect(isReserved(email, "user@example.com.evil.test")).toBe(true); // .test is reserved
    expect(isReserved(email, "user@example.com.evil.io")).toBe(false);
  });
});

describe("catalog.isReservedHandlesMalformedInput", () => {
  it("returns false (never throws) on junk values", () => {
    const cases: [Parameters<typeof getEntry>[0], string][] = [
      ["email", ""],
      ["email", "no-at-sign"],
      ["email", "alice@realmail.com"],
      ["ipv4", "abc"],
      ["ipv4", "999.999.999.999"],
      ["ipv4", "192.0.2"],
      ["ipv6", "not-an-ip"],
      ["ipv6", "2001:db8:::1"],
      ["phone", ""],
      ["phone", "abc"],
      ["ssn", "12"],
      ["ssn", "abcdefghi"],
      ["creditCard", ""],
      ["creditCard", "nope"],
    ];
    for (const [field, value] of cases) {
      expect(() => isReserved(getEntry(field), value), `${field} "${value}"`).not.toThrow();
      expect(isReserved(getEntry(field), value), `${field} "${value}"`).toBe(false);
    }
  });
});

describe("catalog.rangeBoundaries", () => {
  it("ipv4 includes the whole /24 and excludes neighbors", () => {
    const e = getEntry("ipv4");
    expect(isReserved(e, "192.0.2.0")).toBe(true);
    expect(isReserved(e, "192.0.2.255")).toBe(true);
    expect(isReserved(e, "192.0.1.255")).toBe(false);
    expect(isReserved(e, "192.0.3.0")).toBe(false);
  });

  it("ipv6 includes the documentation prefix and excludes neighbors", () => {
    const e = getEntry("ipv6");
    expect(isReserved(e, "2001:db8::")).toBe(true);
    expect(isReserved(e, "2001:db8:ffff:ffff::1")).toBe(true);
    expect(isReserved(e, "2001:db9::")).toBe(false);
    expect(isReserved(e, "2001:0db7:ffff::1")).toBe(false);
  });

  it("phone accepts the whole 555-0100..0199 block and rejects the edges", () => {
    const e = getEntry("phone");
    expect(isReserved(e, "212-555-0100")).toBe(true);
    expect(isReserved(e, "212-555-0199")).toBe(true);
    expect(isReserved(e, "212-555-0099")).toBe(false);
    expect(isReserved(e, "212-555-0200")).toBe(false);
  });
});
