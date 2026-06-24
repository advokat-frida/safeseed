// One-off: refresh the committed examples to the current core.
//
// 1. Reproduce examples/customers.csv deterministically from the committed record's
//    schema + seed + rowCount, and ASSERT it is byte-identical to the committed CSV
//    (catches any silent generator drift before we trust the new record).
// 2. Re-emit examples/customers.record.json via makeRunRecord, so it carries the
//    current catalog claims AND the new per-column hashes. The CSV bytes are
//    unchanged, so the content hash and strict verify are unchanged.
// 3. Write examples/customers-extended.csv = customers.csv + an added business
//    column ("job_title"), the fixture the column-scoped CI dogfood verifies.
//
// Run from the repo root after `npm run build`:  node scripts/regen-fixtures.mjs
import { readFileSync, writeFileSync } from "node:fs";
import {
  generate,
  toCsv,
  parseCsv,
  makeRunRecord,
  verify,
} from "../dist/index.js";

const csvPath = "examples/customers.csv";
const recPath = "examples/customers.record.json";
const extPath = "examples/customers-extended.csv";

const committedCsv = readFileSync(csvPath, "utf8");
const oldRecord = JSON.parse(readFileSync(recPath, "utf8"));

const schema = oldRecord.fields.map((f) => ({ name: f.name, type: f.type }));
const ds = generate({ schema, rows: oldRecord.rowCount, seed: oldRecord.seed });
const reproduced = toCsv(ds.columns, ds.rows);

if (reproduced !== committedCsv) {
  console.error("FATAL: regenerated CSV does not match committed examples/customers.csv.");
  console.error("The generator changed since the fixture was committed; not overwriting.");
  process.exit(1);
}

const record = await makeRunRecord(ds, reproduced);
writeFileSync(recPath, JSON.stringify(record, null, 2) + "\n");

// Sanity: strict verify still passes against the untouched CSV.
const strict = await verify(committedCsv, record);
if (!strict.ok) {
  console.error("FATAL: strict verify failed after regen:", strict.failures);
  process.exit(1);
}

// Build the extended fixture: same data + one team-added business column.
const { columns, rows } = parseCsv(committedCsv);
const ROLES = ["Engineer", "Analyst", "Manager", "Researcher", "Designer"];
const extended = toCsv(
  [...columns, "job_title"],
  rows.map((r, i) => [...r, ROLES[i % ROLES.length]]),
);
writeFileSync(extPath, extended);

// Sanity: extended passes column-scoped, fails strict.
const scoped = await verify(extended, record, { allowAddedColumns: true });
const strictExt = await verify(extended, record);
if (!scoped.ok || strictExt.ok) {
  console.error("FATAL: extended fixture did not behave as expected.", {
    scopedOk: scoped.ok,
    scopedFailures: scoped.failures,
    strictExtOk: strictExt.ok,
  });
  process.exit(1);
}

console.log("OK:");
console.log("  record now has per-column hashes:", record.fields.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
console.log("  content hash unchanged:", record.contentSha256 === oldRecord.contentSha256);
console.log("  strict verify on customers.csv:", strict.ok);
console.log("  column-scoped on extended:", scoped.ok, "| unattested:", scoped.unattestedColumns);
console.log("  strict on extended (should be false):", strictExt.ok);
