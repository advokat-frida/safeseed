/**
 * Core type vocabulary for SafeSeed.
 *
 * The honesty tier is the load-bearing concept: every value SafeSeed touches is
 * classified by *how* it is known to be non-real, and the language allowed about
 * it follows from the tier (see `record.ts`).
 */

/**
 * How a value is known to be non-real. Ordered from strongest to weakest claim.
 *
 * - `provably-non-real`     reserved by a published standard; cannot belong to a
 *                           real person or system (RFC 2606 domains, RFC 5737 /
 *                           3849 IPs, NANPA 555-01xx phones, unassigned SSN ranges).
 * - `designated-test-only`  a valid-looking value that networks/sandboxes have
 *                           *designated* for testing (e.g. card test PANs). It
 *                           passes validation, so it is non-real by designation,
 *                           NOT by impossibility.
 * - `structurally-fake`     no standard reserves it (names, addresses, free text),
 *                           so it is made self-evidently fake instead of plausible.
 */
export type Tier =
  | "provably-non-real"
  | "designated-test-only"
  | "structurally-fake";

/** The PII-shaped field types SafeSeed knows how to generate, verify, and scan. */
export type FieldType =
  | "email"
  | "domain"
  | "ipv4"
  | "ipv6"
  | "phone"
  | "ssn"
  | "creditCard"
  | "firstName"
  | "lastName"
  | "fullName"
  | "streetAddress"
  | "freeText";
