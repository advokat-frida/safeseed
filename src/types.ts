/**
 * Core type vocabulary for SafeSeed.
 *
 * The assurance tier is the load-bearing concept: every catalog value is
 * classified by the source of the constraint behind it, and the language allowed
 * about it follows from the tier (see `record.ts`).
 */

/**
 * What supports the claim made about a generated value. Ordered from the most
 * structural constraint to the most deliberately artificial convention.
 *
 * - `protocol-reserved`     reserved by a published internet standard for
 *                           documentation/testing (RFC 2606 names, RFC 5737 / 3849
 *                           addresses). The claim is reservation, not that no
 *                           infrastructure could ever handle the value.
 * - `authority-reserved`    designated fictitious or invalid under an issuing
 *                           authority's current policy (NANPA 555-01xx phones,
 *                           SSA-invalid SSN components). This must be revalidated
 *                           when the catalog or cited policy changes.
 * - `designated-test-only`  a valid-looking value that networks/sandboxes have
 *                           *designated* for testing (e.g. card test PANs). It
 *                           passes validation, so it is non-real by designation,
 *                           NOT by impossibility.
 * - `structurally-fake`     no standard reserves it (names, addresses, free text),
 *                           so it is made self-evidently fake instead of plausible.
 */
export type Tier =
  | "protocol-reserved"
  | "authority-reserved"
  | "designated-test-only"
  | "structurally-fake";

/** Tier strings emitted before catalog 3.0.0. Old run records remain readable. */
export type LegacyTier = "provably-non-real" | "reserved-not-issued";

/** The PII-shaped field types SafeSeed knows how to generate, verify, and scan. */
export type FieldType =
  | "email"
  | "sha256Email"
  | "domain"
  | "ipv4"
  | "ipv6"
  | "phone"
  | "ukPhone"
  | "sha256Phone"
  | "ssn"
  | "creditCard"
  | "marketingUrl"
  | "opaqueId"
  | "firstName"
  | "lastName"
  | "fullName"
  | "streetAddress"
  | "freeText";
