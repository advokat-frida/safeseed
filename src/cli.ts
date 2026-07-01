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
import {
  generate,
  toCsv,
  makeRunRecord,
  verify,
  scan,
  exitCode,
  CATALOG,
  CATALOG_VERSION,
  SAFESEED_VERSION,
  type FieldSchema,
  type FieldType,
  type ScanColumn,
  type RunRecord,
} from "./index.js";

interface Parsed {
  _: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq >= 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { _: positional, flags };
}

function fail(msg: string): never {
  process.stderr.write(`safeseed: ${msg}\n`);
  process.exit(2);
}

function reqStr(p: Parsed, key: string): string {
  const v = p.flags[key];
  if (typeof v !== "string" || v === "") fail(`missing required --${key}`);
  return v as string;
}

const VALID_TYPES = new Set<string>(CATALOG.map((e) => e.field));

function parseFields(spec: string): FieldSchema[] {
  return spec.split(",").map((pair) => {
    const [name, type] = pair.split(":").map((s) => s.trim());
    if (!name || !type) fail(`bad --fields entry "${pair}" (expected name:type)`);
    if (!VALID_TYPES.has(type)) fail(`unknown field type "${type}" (run: safeseed catalog)`);
    return { name, type: type as FieldType };
  });
}

function cmdGenerate(p: Parsed): Promise<void> {
  let schema: FieldSchema[] = [];
  let rows = 0;
  // Deliberate: --seed defaults to 0, so a no-seed run is a repeatable run, not a
  // random one — determinism is the product. Documented in --help and the README.
  let seed = 0;
  let formatValid = true;

  if (typeof p.flags.config === "string") {
    const cfg = JSON.parse(readFileSync(p.flags.config, "utf8")) as Partial<{
      schema: FieldSchema[];
      rows: number;
      seed: number;
      formatValid: boolean;
    }>;
    if (cfg.schema) schema = cfg.schema;
    if (typeof cfg.rows === "number") rows = cfg.rows;
    if (typeof cfg.seed === "number") seed = cfg.seed;
    if (typeof cfg.formatValid === "boolean") formatValid = cfg.formatValid;
  }
  if (typeof p.flags.fields === "string") schema = parseFields(p.flags.fields);
  if (p.flags.rows !== undefined) rows = Number(p.flags.rows);
  if (p.flags.seed !== undefined) seed = Number(p.flags.seed);
  if (p.flags["format-valid"] !== undefined) formatValid = p.flags["format-valid"] !== "false";

  if (schema.length === 0) fail("no schema (use --config <file> or --fields name:type,...)");
  if (!Number.isInteger(rows) || rows <= 0) fail("--rows must be a positive integer");
  if (!Number.isFinite(seed)) fail("--seed must be a number");

  const ds = generate({ schema, rows, seed, formatValid });
  const csv = toCsv(ds.columns, ds.rows);

  if (typeof p.flags.out === "string") writeFileSync(p.flags.out, csv);
  else process.stdout.write(csv);

  const recordWork =
    typeof p.flags.record === "string"
      ? makeRunRecord(
          ds,
          csv,
          typeof p.flags.now === "string" ? { generatedAt: p.flags.now } : undefined,
        ).then((rec) => {
          writeFileSync(p.flags.record as string, JSON.stringify(rec, null, 2) + "\n");
        })
      : Promise.resolve();

  return recordWork.then(() => {
    if (typeof p.flags.out === "string") {
      process.stderr.write(`safeseed: wrote ${ds.rows.length} rows to ${p.flags.out}\n`);
    }
  });
}

function boolFlag(p: Parsed, key: string): boolean {
  const v = p.flags[key];
  return v === true || v === "true";
}

async function cmdVerify(p: Parsed): Promise<void> {
  const csv = readFileSync(reqStr(p, "in"), "utf8");
  const record = JSON.parse(readFileSync(reqStr(p, "record"), "utf8")) as RunRecord;
  const allowAddedColumns = boolFlag(p, "allow-added-columns");
  const result = await verify(csv, record, { allowAddedColumns });
  const mode = allowAddedColumns ? " (column-scoped)" : "";
  if (result.ok) {
    process.stdout.write(
      `safeseed verify${mode}: OK — ${result.checked.rows} rows, ${result.checked.fields} fields in range\n`,
    );
  } else {
    process.stdout.write(`safeseed verify${mode}: FAIL — ${result.failures.length} issue(s)\n`);
    for (const f of result.failures.slice(0, 50)) {
      process.stdout.write(`  [${f.kind}] ${f.message}\n`);
    }
    if (result.failures.length > 50) {
      process.stdout.write(`  ...and ${result.failures.length - 50} more\n`);
    }
  }
  if (result.unattestedColumns.length > 0) {
    process.stdout.write(
      `  unattested (added) columns, NOT vouched for — scan these: ${result.unattestedColumns.join(", ")}\n`,
    );
  }
  for (const w of result.warnings) {
    process.stdout.write(`  warning: ${w}\n`);
  }
  process.exit(exitCode(result));
}

function cmdScan(p: Parsed): void {
  let columns: ScanColumn[] = [];
  if (typeof p.flags.config === "string") {
    const cfg = JSON.parse(readFileSync(p.flags.config, "utf8")) as Partial<{
      columns: ScanColumn[];
      schema: ScanColumn[];
    }>;
    columns = cfg.columns ?? cfg.schema ?? [];
  }
  if (typeof p.flags.fields === "string") columns = parseFields(p.flags.fields);
  if (columns.length === 0) fail("no columns (use --config <file> or --fields name:type,...)");

  const csv = readFileSync(reqStr(p, "in"), "utf8");
  const result = scan({ csv, columns });
  if (result.ok) {
    process.stdout.write(`safeseed scan: clean — ${result.scannedRows} rows, no candidate PII\n`);
    process.stdout.write(
      "  note: scan flags real data OUTSIDE the reserved ranges; real data that happens to look reserved " +
        "(a real mailbox at example.com, a real 555-01xx line) is NOT flagged. " +
        'Clean means "nothing provably-unreserved found," not "no real PII."\n',
    );
  } else {
    process.stdout.write(
      `safeseed scan: ${result.findings.length} candidate(s) across ${result.scannedRows} rows\n`,
    );
    for (const f of result.findings.slice(0, 50)) {
      process.stdout.write(`  row ${f.row} ${f.field}: "${f.value}"\n`);
    }
    if (result.findings.length > 50) {
      process.stdout.write(`  ...and ${result.findings.length - 50} more\n`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

function cmdCatalog(): void {
  process.stdout.write(JSON.stringify({ version: CATALOG_VERSION, entries: CATALOG }, null, 2) + "\n");
}

function printUsage(): void {
  process.stdout.write(
    [
      `safeseed ${SAFESEED_VERSION} — confirmably-synthetic test data by construction`,
      "",
      "Usage:",
      "  safeseed generate --fields <name:type,...> --rows N --seed S [--out f.csv] [--record r.json] [--format-valid true|false]",
      "  safeseed generate --config gen.json [--out f.csv] [--record r.json]",
      "  safeseed verify   --in f.csv --record r.json [--allow-added-columns]",
      "  safeseed scan     --in f.csv --fields <name:type,...>",
      "  safeseed catalog",
      "  safeseed version",
      "",
      "Field types: " + [...VALID_TYPES].join(", "),
      "",
      "Notes:",
      "  --seed defaults to 0, so runs without it are fully deterministic (identical",
      "  output every time); pass --seed to vary the dataset.",
      "  scan flags values OUTSIDE the reserved ranges; real data that happens to look",
      '  reserved is not flagged — clean means "nothing provably-unreserved found."',
      "",
      "Exit codes: 0 clean · 1 drift/findings · 2 usage/IO error",
    ].join("\n") + "\n",
  );
}

async function main(): Promise<void> {
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
    case "version":
    case undefined:
      if (cmd === "version") {
        process.stdout.write(`safeseed ${SAFESEED_VERSION} (catalog ${CATALOG_VERSION})\n`);
      } else {
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

main().catch((e: unknown) => {
  process.stderr.write(`safeseed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
});
