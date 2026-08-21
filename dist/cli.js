#!/usr/bin/env node
/**
 * SafeSeed CLI — the shell CI actually calls.
 *
 *   safeseed generate --fields email:email,phone:phone --rows 100 --seed 42 \
 *                     --out data.csv --record record.json
 *   safeseed verify   --in data.csv --record record.json     # exits non-zero on drift
 *   safeseed verify   --in data.csv --record record.json --allow-added-columns
 *                                                            # column-scoped: attest the
 *                                                            # synthetic columns, report added ones
 *   safeseed scan     --in legacy.csv --fields email:email,phone:phone
 *   safeseed catalog                                          # print the reserved-range catalog
 *
 * No network, no config beyond the files you point it at. Exit codes: 0 clean,
 * 1 drift/findings, 2 usage/IO error.
 */
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { generate, toCsv, makeRunRecord, verify, scan, exitCode, CATALOG, CATALOG_VERSION, SAFESEED_VERSION, MAX_GENERATE_ROWS, MAX_GENERATE_SEED, SCHEMA_PRESETS, schemaFromPreset, } from "./index.js";
function parseArgs(argv) {
    const positional = [];
    const flags = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
            const eq = a.indexOf("=");
            if (eq >= 0) {
                flags[a.slice(2, eq)] = a.slice(eq + 1);
            }
            else {
                const key = a.slice(2);
                const next = argv[i + 1];
                if (next !== undefined && !next.startsWith("--")) {
                    flags[key] = next;
                    i++;
                }
                else {
                    flags[key] = true;
                }
            }
        }
        else {
            positional.push(a);
        }
    }
    return { _: positional, flags };
}
/** Render untrusted diagnostics as one bounded line so CI logs cannot execute them. */
function safeDiagnostic(value) {
    const escaped = String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, (character) => {
        const code = character.codePointAt(0) ?? 0;
        return `\\u${code.toString(16).padStart(4, "0")}`;
    });
    return escaped.length <= 240 ? escaped : `${escaped.slice(0, 237)}...`;
}
function fail(msg) {
    process.stderr.write(`safeseed: ${safeDiagnostic(msg)}\n`);
    process.exit(2);
}
function verifyFailureDiagnostic(failure) {
    const field = failure.field === undefined ? "declared field" : `"${safeDiagnostic(failure.field)}"`;
    const row = failure.row === undefined ? "" : ` row ${failure.row}`;
    switch (failure.kind) {
        case "invalid-record":
            return `invalid verification record: ${safeDiagnostic(failure.message)}`;
        case "malformed-csv":
            return `malformed CSV: ${safeDiagnostic(failure.message)}`;
        case "content-hash-mismatch":
            return "current file hash does not match the verification record";
        case "out-of-range-value":
            return `${field}${row}: value redacted; outside the configured catalog constraint`;
        case "schema-mismatch":
            return failure.field === undefined
                ? "file columns do not match the verification record"
                : `${field} is ambiguous or inconsistent with the verification record`;
        case "row-arity-mismatch":
            return `${row.trim() || "row"}: cell count does not match the expected width`;
        case "missing-column":
            return `${field} is missing from the file`;
        case "column-hash-mismatch":
            return `${field} hash does not match the verification record`;
    }
}
function reqStr(p, key) {
    const v = p.flags[key];
    if (typeof v !== "string" || v === "")
        fail(`missing required --${key}`);
    return v;
}
const VALID_TYPES = new Set(CATALOG.map((e) => e.field));
function validateSchema(value) {
    if (!Array.isArray(value))
        fail("schema must be an array of { name, type } entries");
    const schema = value.map((candidate, index) => {
        if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
            fail(`schema entry ${index} must be an object with name and type`);
        }
        const raw = candidate;
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        const type = typeof raw.type === "string" ? raw.type.trim() : "";
        if (name === "" || type === "")
            fail(`schema entry ${index} needs a nonblank name and type`);
        if (/[\u0000-\u001f\u007f-\u009f]/u.test(name)) {
            fail(`schema entry ${index} name must not contain control characters`);
        }
        if (!VALID_TYPES.has(type))
            fail(`unknown field type "${type}" (run: safeseed catalog)`);
        return { name, type: type };
    });
    const names = schema.map((field) => field.name);
    if (new Set(names).size !== names.length)
        fail("schema column names must be unique");
    return schema;
}
function parseFields(spec) {
    const entries = spec.split(",").map((pair) => {
        const parts = pair.split(":");
        if (parts.length !== 2)
            fail(`bad --fields entry "${pair}" (expected name:type)`);
        return { name: parts[0], type: parts[1] };
    });
    return validateSchema(entries);
}
function cmdGenerate(p) {
    let schema = [];
    let rows = 0;
    // Deliberate: --seed defaults to 0, so a no-seed run is a repeatable run, not a
    // random one — determinism is the product. Documented in --help and the README.
    let seed = 0;
    let formatValid = true;
    if (typeof p.flags.preset === "string") {
        schema = schemaFromPreset(p.flags.preset);
        rows = 100;
    }
    if (typeof p.flags.config === "string") {
        const cfg = JSON.parse(readFileSync(p.flags.config, "utf8"));
        if (cfg.schema !== undefined)
            schema = validateSchema(cfg.schema);
        if (typeof cfg.rows === "number")
            rows = cfg.rows;
        if (typeof cfg.seed === "number")
            seed = cfg.seed;
        if (typeof cfg.formatValid === "boolean")
            formatValid = cfg.formatValid;
    }
    if (typeof p.flags.fields === "string")
        schema = parseFields(p.flags.fields);
    if (p.flags.rows !== undefined)
        rows = Number(p.flags.rows);
    if (p.flags.seed !== undefined)
        seed = Number(p.flags.seed);
    if (p.flags["format-valid"] !== undefined)
        formatValid = p.flags["format-valid"] !== "false";
    if (schema.length === 0)
        fail("no schema (use --config <file> or --fields name:type,...)");
    if (!Number.isSafeInteger(rows) || rows < 1 || rows > MAX_GENERATE_ROWS) {
        fail(`--rows must be an integer from 1 to ${MAX_GENERATE_ROWS}`);
    }
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_GENERATE_SEED) {
        fail(`--seed must be an integer from 0 to ${MAX_GENERATE_SEED}`);
    }
    const ds = generate({ schema, rows, seed, formatValid });
    const csv = toCsv(ds.columns, ds.rows);
    const recordWork = typeof p.flags.record === "string"
        ? makeRunRecord(ds, csv, typeof p.flags.now === "string" ? { generatedAt: p.flags.now } : undefined)
        : Promise.resolve(null);
    return recordWork.then((record) => {
        if (typeof p.flags.out === "string")
            writeFileSync(p.flags.out, csv);
        else
            process.stdout.write(csv);
        if (record !== null) {
            writeFileSync(p.flags.record, JSON.stringify(record, null, 2) + "\n");
        }
        if (typeof p.flags.out === "string") {
            process.stderr.write(`safeseed: wrote ${ds.rows.length} rows to ${safeDiagnostic(p.flags.out)}\n`);
        }
    });
}
function boolFlag(p, key) {
    const v = p.flags[key];
    return v === true || v === "true";
}
async function cmdVerify(p) {
    const csv = readFileSync(reqStr(p, "in"), "utf8");
    const record = JSON.parse(readFileSync(reqStr(p, "record"), "utf8"));
    const allowAddedColumns = boolFlag(p, "allow-added-columns");
    const result = await verify(csv, record, { allowAddedColumns });
    const mode = allowAddedColumns ? " (column-scoped)" : "";
    if (result.ok) {
        process.stdout.write(`safeseed verify${mode}: OK — ${result.checked.rows} rows, ${result.checked.fields} fields in range\n`);
    }
    else {
        process.stdout.write(`safeseed verify${mode}: FAIL — ${result.failures.length} issue(s)\n`);
        for (const f of result.failures.slice(0, 50)) {
            process.stdout.write(`  [${f.kind}] ${verifyFailureDiagnostic(f)}\n`);
        }
        if (result.failures.length > 50) {
            process.stdout.write(`  ...and ${result.failures.length - 50} more\n`);
        }
    }
    if (result.unattestedColumns.length > 0) {
        process.stdout.write(`  unattested (added) columns, NOT vouched for — scan these: ${result.unattestedColumns.map(safeDiagnostic).join(", ")}\n`);
    }
    for (const w of result.warnings) {
        process.stdout.write(`  warning: ${safeDiagnostic(w)}\n`);
    }
    process.exit(exitCode(result));
}
function cmdScan(p) {
    let columns = [];
    if (typeof p.flags.config === "string") {
        const cfg = JSON.parse(readFileSync(p.flags.config, "utf8"));
        const configured = cfg.columns ?? cfg.schema;
        if (configured !== undefined)
            columns = validateSchema(configured);
    }
    if (typeof p.flags.fields === "string")
        columns = parseFields(p.flags.fields);
    if (columns.length === 0)
        fail("no columns (use --config <file> or --fields name:type,...)");
    const csv = readFileSync(reqStr(p, "in"), "utf8");
    const result = scan({ csv, columns });
    if (result.ok) {
        process.stdout.write(`safeseed scan: clean — ${result.scannedRows} rows, no candidate PII\n`);
        process.stdout.write("  note: scan flags real data OUTSIDE the reserved ranges; real data that happens to look reserved " +
            "(a real mailbox at example.com, a real 555-01xx line) is NOT flagged. " +
            'Clean means "nothing outside the configured ranges found," not "no real PII."\n');
    }
    else {
        if (result.parseErrors.length > 0) {
            process.stdout.write("safeseed scan: FAIL — malformed CSV\n");
        }
        else {
            process.stdout.write(`safeseed scan: ${result.findings.length} candidate(s) across ${result.scannedRows} rows\n`);
        }
        for (const error of result.parseErrors) {
            process.stdout.write(`  [malformed-csv] ${safeDiagnostic(error)}\n`);
        }
        for (const f of result.findings.slice(0, 50)) {
            process.stdout.write(`  row ${f.row} ${safeDiagnostic(f.field)}: candidate value redacted; outside configured ${f.type} range\n`);
        }
        if (result.findings.length > 50) {
            process.stdout.write(`  ...and ${result.findings.length - 50} more\n`);
        }
        // A named column the scan could not check is a failure, never a silent skip —
        // otherwise a typo'd --fields name reads as a clean scan.
        for (const name of result.missingColumns) {
            process.stdout.write(`  [missing-column] "${safeDiagnostic(name)}" is not in the file's header — not scanned\n`);
        }
        for (const name of result.duplicateColumns) {
            process.stdout.write(`  [duplicate-column] "${safeDiagnostic(name)}" matches more than one header — ambiguous, not scanned\n`);
        }
        for (const row of result.malformedRows) {
            process.stdout.write(`  [malformed-row] row ${row}: cell count differs from the header — not a clean scan\n`);
        }
    }
    process.exit(result.ok ? 0 : 1);
}
function cmdCatalog() {
    process.stdout.write(JSON.stringify({ version: CATALOG_VERSION, entries: CATALOG }, null, 2) + "\n");
}
function cmdPresets() {
    process.stdout.write(JSON.stringify({ presets: SCHEMA_PRESETS }, null, 2) + "\n");
}
function printUsage() {
    process.stdout.write([
        `safeseed ${SAFESEED_VERSION} — auditable, catalog-constrained test data`,
        "",
        "Usage:",
        "  safeseed generate --fields <name:type,...> --rows N --seed S [--out f.csv] [--record r.json] [--format-valid true|false]",
        "  safeseed generate --config gen.json [--out f.csv] [--record r.json]",
        "  safeseed generate --preset <id> [--rows N] [--seed S] [--out f.csv] [--record r.json]",
        "  safeseed verify   --in f.csv --record r.json [--allow-added-columns]",
        "  safeseed scan     --in f.csv --fields <name:type,...>",
        "  safeseed catalog",
        "  safeseed presets",
        "  safeseed version",
        "",
        "Field types: " + [...VALID_TYPES].join(", "),
        "Schema presets: " + SCHEMA_PRESETS.map((preset) => preset.id).join(", "),
        "",
        "Notes:",
        "  --seed defaults to 0, so runs without it are fully deterministic (identical",
        "  output every time); pass --seed to vary the dataset.",
        "  scan flags values OUTSIDE the reserved ranges; real data that happens to look",
        '  reserved is not flagged — clean means "nothing outside the configured ranges found."',
        "",
        "Exit codes: 0 clean · 1 drift/findings · 2 usage/IO error",
    ].join("\n") + "\n");
}
async function main() {
    const p = parseArgs(process.argv.slice(2));
    const cmd = p._[0];
    switch (cmd) {
        case "generate":
            await cmdGenerate(p);
            break;
        case "verify":
            await cmdVerify(p);
            break;
        case "scan":
            cmdScan(p);
            break;
        case "catalog":
            cmdCatalog();
            break;
        case "presets":
            cmdPresets();
            break;
        case "version":
        case undefined:
            if (cmd === "version") {
                process.stdout.write(`safeseed ${SAFESEED_VERSION} (catalog ${CATALOG_VERSION})\n`);
            }
            else {
                printUsage();
            }
            break;
        case "help":
            printUsage();
            break;
        default:
            printUsage();
            process.exit(2);
    }
}
main().catch((e) => {
    process.stderr.write(`safeseed: ${safeDiagnostic(e instanceof Error ? e.message : String(e))}\n`);
    process.exit(2);
});
//# sourceMappingURL=cli.js.map