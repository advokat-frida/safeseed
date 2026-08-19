/**
 * SafeSeed — auditable, low-fidelity test data by construction.
 *
 * Generate catalog-constrained test data without a production source dataset,
 * bind an unsigned integrity record to declared fields, compare current bytes and
 * ranges with that record, and scan existing data for out-of-range candidates.
 * Pure TypeScript, zero runtime dependencies, isomorphic (Node >=22 and browsers).
 */
export type { Tier, LegacyTier, FieldType } from "./types.js";

export {
  CATALOG,
  CATALOG_VERSION,
  getEntry,
  isReserved,
  isSelfEvidentlyFake,
  type CatalogEntry,
  type ReservedSpec,
} from "./catalog.js";

export {
  generate,
  type FieldSchema,
  type GenerateOptions,
  type GeneratedDataset,
} from "./generate.js";

export {
  makeRunRecord,
  validateRunRecord,
  ATTESTATION,
  SAFESEED_VERSION,
  type RunRecord,
  type RunRecordValidation,
  type FieldRecord,
} from "./record.js";

export {
  verify,
  exitCode,
  type VerifyResult,
  type VerifyFailure,
  type VerifyFailureKind,
  type VerifyOptions,
} from "./verify.js";

export {
  scan,
  type ScanColumn,
  type ScanOptions,
  type ScanResult,
  type ScanFinding,
} from "./scan.js";

export { toCsv, parseCsv, canonicalColumn } from "./csv.js";
export { sha256Hex } from "./hash.js";
export { luhnValid } from "./luhn.js";
