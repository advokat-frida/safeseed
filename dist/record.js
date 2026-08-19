/**
 * The unsigned integrity run record.
 *
 * A run record binds to the exact bytes supplied at record creation (a SHA-256
 * content hash) and states, per declared SafeSeed field, the catalog constraint and
 * assurance tier used. Other columns may exist, but they are not field-attested.
 * It is deliberately a comparison record, not authenticated provenance or
 * "cryptographic proof that the file contains no PII." Drift evidence depends on
 * protecting or reviewing the record separately from the file being checked.
 */
import { CATALOG, CATALOG_VERSION, getEntry, isReserved } from "./catalog.js";
import { sha256Hex } from "./hash.js";
import { canonicalColumn, parseCsv } from "./csv.js";
// 0.3.0 treats the run-record metadata itself as an enforcement boundary. Older
// records carried overbroad claims and weaker shapes (including optional column
// hashes), so current verification fails them closed and asks for regeneration
// instead of silently trusting metadata it cannot authenticate.
export const SAFESEED_VERSION = "0.3.0";
export const ATTESTATION = [
    "This unsigned run record records the caller's declaration that the declared",
    "SafeSeed fields came from the versioned catalog path, which accepts no production",
    "dataset as generator input. makeRunRecord checks that those fields match the",
    "supplied CSV and current catalog constraints; it cannot authenticate how a",
    "structurally supplied dataset object was created. It does not attest any",
    "column omitted from its fields list. It is an unsigned integrity record, not",
    "authenticated provenance. It is not a cryptographic proof that the overall file",
    "contains no personal data. It binds to the file's content hash so current bytes can be",
    "compared with an independently protected copy of the record; anyone who can edit",
    "the file and record can recompute both.",
    '"Not derived from production data" is not the same claim as "not personal data."',
    "Re-verify against the actual artifact in your pipeline (GDPR Art. 25/32 control",
    "for non-production environments; not a scope-out from privacy law).",
].join(" ");
const FIELD_TYPES = new Set(CATALOG.map((entry) => entry.field));
const TIERS = new Set([
    "protocol-reserved",
    "authority-reserved",
    "designated-test-only",
    "structurally-fake",
]);
const SHA256 = /^[0-9a-f]{64}$/i;
const SINGLE_LINE = /^[^\r\n\u0000-\u001f\u007f]+$/;
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Runtime validation for JSON records crossing the CLI/browser boundary. TypeScript
 * types disappear at runtime, so verification must fail closed rather than trust a
 * cast object or throw while dereferencing malformed attacker-controlled metadata.
 */
export function validateRunRecord(value) {
    if (!isObject(value))
        return { ok: false, errors: ["run record must be a JSON object"] };
    const errors = [];
    const requireSingleLine = (key) => {
        const candidate = value[key];
        if (typeof candidate !== "string" || !SINGLE_LINE.test(candidate)) {
            errors.push(`${key} must be a non-empty single-line string`);
            return null;
        }
        return candidate;
    };
    const safeseedVersion = requireSingleLine("safeseedVersion");
    const catalogVersion = requireSingleLine("catalogVersion");
    if (safeseedVersion !== null && safeseedVersion !== SAFESEED_VERSION) {
        errors.push(`unsupported safeseedVersion; regenerate the record with SafeSeed ${SAFESEED_VERSION}`);
    }
    if (catalogVersion !== null && catalogVersion !== CATALOG_VERSION) {
        errors.push(`unsupported catalogVersion; regenerate the record with catalog ${CATALOG_VERSION}`);
    }
    if (typeof value.seed !== "number" || !Number.isFinite(value.seed)) {
        errors.push("seed must be a finite number");
    }
    if (!Number.isInteger(value.rowCount) || value.rowCount < 0) {
        errors.push("rowCount must be a non-negative integer");
    }
    if (typeof value.contentSha256 !== "string" || !SHA256.test(value.contentSha256)) {
        errors.push("contentSha256 must be a 64-character hexadecimal SHA-256");
    }
    if (value.attestation !== ATTESTATION) {
        errors.push("attestation does not match the current SafeSeed record contract");
    }
    if (value.generatedAt !== undefined &&
        (typeof value.generatedAt !== "string" || !SINGLE_LINE.test(value.generatedAt))) {
        errors.push("generatedAt must be a non-empty single-line string when present");
    }
    const columns = value.columns;
    if (!Array.isArray(columns) || columns.some((column) => typeof column !== "string")) {
        errors.push("columns must be an array of strings");
    }
    else {
        if (columns.some((column) => !SINGLE_LINE.test(column))) {
            errors.push("declared column names must be non-empty single-line strings");
        }
        if (new Set(columns).size !== columns.length) {
            errors.push("declared column names must be unique");
        }
    }
    const fields = value.fields;
    if (!Array.isArray(fields)) {
        errors.push("fields must be an array");
    }
    else {
        fields.forEach((field, index) => {
            if (!isObject(field)) {
                errors.push(`field ${index} must be an object`);
                return;
            }
            if (typeof field.name !== "string" || !SINGLE_LINE.test(field.name)) {
                errors.push(`field ${index} name must be a non-empty single-line string`);
            }
            if (typeof field.type !== "string" || !FIELD_TYPES.has(field.type)) {
                errors.push(`field ${index} has an unknown type`);
                return;
            }
            if (typeof field.tier !== "string" || !TIERS.has(field.tier)) {
                errors.push(`field ${index} has an unknown assurance tier`);
            }
            if (typeof field.citation !== "string" || field.citation.trim() === "") {
                errors.push(`field ${index} citation must be a non-empty string`);
            }
            if (typeof field.claim !== "string" || field.claim.trim() === "") {
                errors.push(`field ${index} claim must be a non-empty string`);
            }
            if (typeof field.sha256 !== "string" || !SHA256.test(field.sha256)) {
                errors.push(`field ${index} sha256 must be a 64-character hexadecimal SHA-256`);
            }
            if (catalogVersion === CATALOG_VERSION) {
                const current = getEntry(field.type);
                if (field.tier !== current.tier)
                    errors.push(`field ${index} tier does not match the current catalog`);
                if (field.citation !== current.citation)
                    errors.push(`field ${index} citation does not match the current catalog`);
                if (field.claim !== current.claim)
                    errors.push(`field ${index} claim does not match the current catalog`);
            }
        });
    }
    if (Array.isArray(columns) && Array.isArray(fields)) {
        if (fields.length !== columns.length) {
            errors.push("fields must contain exactly one entry for each declared column");
        }
        const comparable = Math.min(fields.length, columns.length);
        for (let index = 0; index < comparable; index++) {
            const field = fields[index];
            if (isObject(field) && typeof field.name === "string" && field.name !== columns[index]) {
                errors.push(`field ${index} name does not match columns[${index}]`);
            }
        }
    }
    return errors.length === 0
        ? { ok: true, record: value }
        : { ok: false, errors };
}
function assertRecordableDataset(dataset, csv) {
    if (dataset.catalogVersion !== CATALOG_VERSION) {
        throw new Error(`cannot create a current run record from catalog ${dataset.catalogVersion}; expected ${CATALOG_VERSION}`);
    }
    if (!Number.isFinite(dataset.seed)) {
        throw new Error("cannot create a run record with a non-finite seed");
    }
    if (dataset.columns.length !== dataset.schema.length ||
        !dataset.columns.every((column, index) => column === dataset.schema[index]?.name)) {
        throw new Error("dataset columns do not match its declared schema");
    }
    if (new Set(dataset.columns).size !== dataset.columns.length) {
        throw new Error("dataset contains duplicate declared column names");
    }
    const parsed = parseCsv(csv);
    if (parsed.rows.length !== dataset.rows.length) {
        throw new Error("supplied CSV row count does not match the dataset");
    }
    if (parsed.rows.some((row) => row.length !== parsed.columns.length)) {
        throw new Error("supplied CSV is not rectangular");
    }
    for (let c = 0; c < dataset.schema.length; c++) {
        const field = dataset.schema[c];
        const occurrences = parsed.columns.reduce((count, column) => count + (column === field.name ? 1 : 0), 0);
        if (occurrences !== 1) {
            throw new Error(`declared column "${field.name}" must appear exactly once in the supplied CSV`);
        }
        const csvIndex = parsed.columns.indexOf(field.name);
        const entry = getEntry(field.type);
        for (let r = 0; r < dataset.rows.length; r++) {
            const datasetRow = dataset.rows[r];
            if (datasetRow.length !== dataset.schema.length) {
                throw new Error(`dataset row ${r} does not match its declared schema width`);
            }
            const value = datasetRow[c];
            if (!isReserved(entry, value)) {
                throw new Error(`dataset field "${field.name}" row ${r} is outside the current ${field.type} catalog constraint`);
            }
            if (parsed.rows[r][csvIndex] !== value) {
                throw new Error(`supplied CSV does not match dataset field "${field.name}" at row ${r}`);
            }
        }
    }
}
export async function makeRunRecord(dataset, csv, opts) {
    assertRecordableDataset(dataset, csv);
    const contentSha256 = await sha256Hex(csv);
    const fields = await Promise.all(dataset.schema.map(async (f, c) => {
        const entry = getEntry(f.type);
        const column = dataset.rows.map((row) => row[c] ?? "");
        return {
            name: f.name,
            type: f.type,
            tier: entry.tier,
            citation: entry.citation,
            claim: entry.claim,
            sha256: await sha256Hex(canonicalColumn(column)),
        };
    }));
    const record = {
        safeseedVersion: SAFESEED_VERSION,
        catalogVersion: dataset.catalogVersion ?? CATALOG_VERSION,
        seed: dataset.seed,
        rowCount: dataset.rows.length,
        columns: dataset.columns,
        fields,
        contentSha256,
        attestation: ATTESTATION,
        ...(opts?.generatedAt !== undefined ? { generatedAt: opts.generatedAt } : {}),
    };
    const validation = validateRunRecord(record);
    if (!validation.ok) {
        throw new Error(`cannot create run record: ${validation.errors.join("; ")}`);
    }
    return validation.record;
}
//# sourceMappingURL=record.js.map