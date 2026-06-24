/**
 * SafeSeed — confirmably-synthetic test data by construction.
 *
 * Generate safe-by-construction test data from standards-reserved ranges, bind a
 * tamper-evident run record to it, verify a file stays in range, and scan existing
 * data for leaked real PII. Pure TypeScript, zero runtime dependencies, isomorphic
 * (Node >=18 and browsers).
 */
export type { Tier, FieldType } from "./types.js";

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
  ATTESTATION,
  SAFESEED_VERSION,
  type RunRecord,
  type FieldRecord,
} from "./record.js";

export {
  verify,
  exitCode,
  type VerifyResult,
  type VerifyFailure,
  type VerifyFailureKind,
} from "./verify.js";

export {
  scan,
  type ScanColumn,
  type ScanOptions,
  type ScanResult,
  type ScanFinding,
} from "./scan.js";

export { toCsv, parseCsv } from "./csv.js";
export { sha256Hex } from "./hash.js";
export { luhnValid } from "./luhn.js";
