# SafeSeed

[![CI](https://github.com/advokat-frida/safeseed/actions/workflows/ci.yml/badge.svg)](https://github.com/advokat-frida/safeseed/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/safeseed)](https://www.npmjs.com/package/safeseed) [![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Auditable, low-fidelity test data by construction.** Generate stand-in data for test, CI, and demo environments without using production records as source material for SafeSeed-generated fields. Every declared PII-shaped field comes from a cited protocol-reserved, authority-reserved, test-designated, deliberately fake, or explicitly catalog-derived constraint and carries its actual assurance boundary. Bind an unsigned integrity record to the output, compare current bytes with an independently protected copy of that record, and scan existing data for values outside configured catalog ranges.

No model, no training data, no backend, no accounts, no telemetry, zero runtime dependencies. It runs entirely on your machine. MIT licensed.

> SafeSeed makes *"the declared fields were generated without a production dataset"* a versioned, inspectable claim — and it tells you, field by field, where stronger claims end. The browser generates only catalog fields and verifies only exact whole-file pairs. The CLI/library can explicitly allow added columns, but those columns remain unattested. The full argument is in [docs/safe-test-data-by-construction.md](docs/safe-test-data-by-construction.md).

---

## Why this exists

The breaches teams plan for involve production. The ones that actually happen often involve a *copy* of production sitting somewhere nobody hardened: a staging database, a CI job's fixtures, a developer's laptop, a screenshot in a bug ticket. The fix everyone agrees on is "don't put real data there, use synthetic data." The disagreement is about what "synthetic" should mean.

Model-based synthetic-data tools can **learn the shape of real source data from real source data**, so memorization and re-emission risk must be assessed for the dataset and model rather than assumed away.

SafeSeed takes a narrower path: **its generated-field path does not accept production records as source material.** Each declared field is drawn from a versioned catalog with a cited source and an explicit assurance tier. There is no source record for that path to memorize or re-emit. Review the catalog before release and whenever its standards or authority policies change; each run record names the catalog version, and each declared field inherits only that version's tier-specific claim. Values or columns a user adds are outside that claim and remain explicitly unattested. (The structurally-fake tier also carries the coincidence caveat below.)

## What it does

1. **Generate** catalog-constrained, low-fidelity test data (deterministic from a seed, so the output is a committable fixture).
2. **Record** an unsigned, self-declared integrity receipt that binds to the file's content hash and states every field's assurance tier, citation, claim, and any derivation.
3. **Verify** that a file is still byte-for-byte the generated one *and* that every value is still in range — wire it into CI to fail the build on drift. The CLI and library offer an explicitly partial **column-scoped verify** (`--allow-added-columns`) for teams that add business columns; those columns are reported as *unattested*. The GitHub Action is intentionally stricter: it fails on any added column so a green Action result always covers the whole file.
4. **Scan** an *existing* CSV / seed file and flag values that are not in the configured catalog ranges as candidate real PII. Column-scoped verify pairs with scan: verify vouches for the generated columns, scan checks the columns you added. **Know the limit:** scan flags values *outside* those ranges; real data that happens to look reserved (a mailbox handled at `example.com`, a real `555-01xx` line — or, under the old 0.2.0 ranges, a genuine ITIN) will **not** be flagged. A clean scan means "nothing outside the configured ranges found," not "no real PII."

`verify` and `scan` are **generator-agnostic**: they work on any data file, however it was produced, so you can keep the generator you already use and wrap it.

There is also a self-serve **generator page** with no backend or data upload: start from a practical CRM or marketing schema, edit its generated fields, set rows and seed, preview the tier-colored output, and download the CSV plus its verification file. It does not accept pasted values or an imported production file. Its Verify screen is strict whole-file verification, matching the GitHub Action: any added, removed, reordered, or edited column fails. The expert-only column-scoped option remains explicit in the CLI/library. The application logic ships in a committed single file at [`demo/safeseed-generator.html`](demo/safeseed-generator.html); a hosted copy may request only its same-origin static font assets, while the portable `file://` build uses system fonts and makes no separate request.

### Practical presets and fields

| Preset | What it gives you |
|---|---|
| `crm-contacts` | Contact/account IDs, obvious test names, reserved email, and a NANPA fictitious phone. |
| `marketing-attribution` | Event, cookie, and campaign IDs; constrained UTM landing URL; hashed email and phone match keys. |
| `hashed-audience` | Audience/campaign IDs plus catalog-derived SHA-256 email and phone values. |
| `uk-contacts` | Lead/account IDs, obvious test name, reserved email, and an Ofcom drama mobile. |

The corresponding field types are `opaqueId`, `marketingUrl`, `sha256Email`, `sha256Phone`, and
`ukPhone`. Cookie-like IDs are valid cookie-value strings but remain visibly fake `TEST_` tokens;
SafeSeed does not deliberately break cookie syntax and call the resulting validation failure a
feature. Hashed fields accept only the catalog's published digests of known constrained inputs.
An arbitrary 64-character hash is outside the range and is flagged.

## Quickstart

### CLI

```bash
# Install the CLI (or prefix any command with `npx`, no install needed)
npm install -g safeseed

# Generate 100 rows of catalog-constrained test data + a run record
safeseed generate \
  --fields email:email,name:fullName,phone:phone,ssn:ssn,card:creditCard \
  --rows 100 --seed 42 \
  --out data.csv --record record.json

# Or start from an editable practical schema (100 deterministic rows by default)
safeseed generate --preset marketing-attribution --seed 42 \
  --out marketing.csv --record marketing.record.json

# Fail the build if the file drifts out of range or was tampered with
safeseed verify --in data.csv --record record.json     # exit 0 clean, 1 on drift

# Column-scoped: attest the synthetic columns, allow + report added business columns
safeseed verify --in data.csv --record record.json --allow-added-columns

# Scan a legacy file for values outside the configured ranges
safeseed scan --in legacy.csv --fields email:email,phone:phone,ssn:ssn

# Inspect the reserved-range catalog (every field's range, citation, and tier)
safeseed catalog

# List the built-in practical schemas
safeseed presets
```

`--seed` defaults to `0`, so a run without it is fully deterministic — identical output every time, on purpose (the output is a committable fixture). Pass an integer from `0` through `4294967295` to vary the dataset. Row counts must be integers from `1` through `100000`; SafeSeed is not a load-test generator. Schemas must contain 1 through 256 uniquely named known fields, each column name is limited to 256 single-line characters, and malformed CSV syntax fails closed before any range result is reported.

### As a CI gate (GitHub Action)

The Action is a strict whole-file gate. It runs the CLI bundled into its tagged release, makes no
network requests, needs no secrets or write permissions, and does not download a second, mutable
copy from npm. Column-scoped verification remains available through the CLI and library, but not
through the Action: a successful step means the entire CSV was strictly checked against the
supplied record and current catalog constraints.

```yaml
name: SafeSeed

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  verify-test-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: advokat-frida/safeseed@v0.4.0
        with:
          data: fixtures/seed.csv
          record: fixtures/seed.record.json
```

| Input | Required | Default | Purpose |
|---|---:|---:|---|
| `data` | yes | — | Path to the CSV fixture to verify, relative to the workflow workspace. |
| `record` | yes | — | Path to the current SafeSeed run-record JSON for that fixture. |

SafeSeed fails the step on any whole-file drift, including an added column, as well as an
out-of-range value, malformed row or record, a missing or ambiguous declared column, or a
usage/file error. It runs on
GitHub-hosted Linux, Windows, and macOS runners through GitHub's managed Node 24 Action runtime;
callers do not need `setup-node`. The wrapper terminates a verification process that runs longer
than five minutes; use the CLI directly for unusually large fixtures that need a different job
timeout.

CLI and Action diagnostics redact candidate cell values and render control characters visibly, so
a finding does not copy suspected personal data or workflow commands into CI logs. Library results
retain the value for local programmatic handling. SafeSeed 0.4 accepts only its current, exact run
record contract; regenerate records made by older versions rather than carrying forward legacy
claims or missing per-column hashes.

Run records bind the exact CSV bytes, including line endings. If a fixture is committed and checked
on more than one operating system, pin it in `.gitattributes` (for example,
`*.csv text eol=lf`) and regenerate its record after normalization. The verifier deliberately does
not normalize line endings, because doing so would weaken the whole-file byte-integrity check.

CSV is a data-interchange format, not a spreadsheet safety boundary. Spreadsheet applications may
coerce values such as `+447700900123` or long payment-card test numbers when a CSV is opened. SafeSeed's
browser generator does not accept arbitrary formulas or pasted cells, but teams should still import
generated CSVs with explicit text column types when exact display matters and should never treat
opening an untrusted CSV in a spreadsheet as safe merely because SafeSeed can parse it.

For the strongest supply-chain pin, replace `v0.4.0` with the full commit SHA shown on that release.
Release-specific tags are locked when their immutable GitHub Release is published, while a commit
SHA remains the most explicit pin in the consuming workflow.

### As a library

```ts
import { generate, schemaFromPreset, toCsv, makeRunRecord, verify, scan } from "safeseed";

const ds = generate({
  schema: schemaFromPreset("crm-contacts"),
  rows: 100,
  seed: 42,
});
const csv = toCsv(ds.columns, ds.rows);
const record = await makeRunRecord(ds, csv);

const result = await verify(csv, record); // { ok, failures, checked, unattestedColumns, warnings }

// Column-scoped: attest the synthetic columns only; added columns are reported, not failed.
const scoped = await verify(extendedCsv, record, { allowAddedColumns: true });
// scoped.unattestedColumns lists the business columns the team added — scan those.
```

The library is isomorphic — the same core runs in supported Node releases (>=22) and in the browser, using the platform's Web Crypto for hashing.

## The assurance tiers

Honesty is the credibility here, so the claim has tiers, and every field is labeled with its own:

| Tier | What it means | Examples | The claim |
|---|---|---|---|
| **protocol-reserved** | A published protocol reserves the namespace for documentation or testing; the exact operational consequence differs by field. | RFC 2606 example names, RFC 5737 / 3849 documentation IPs | "Inside the cited protocol-reserved namespace; this alone does not prove no infrastructure could handle it." |
| **authority-reserved** | An issuing authority currently designates the range as fictitious or the pattern as invalid. This policy must be revalidated. | NANPA `555-01xx` phones; Ofcom `07700 900xxx` drama mobiles; SSA-invalid SSN components | "Inside the cited authority's current fictitious or invalid space." |
| **designated-test-only** | A valid-looking value published for processor or sandbox testing. | Card test PANs (`4242…`) | "Intended for test mode by designation, not mathematical impossibility." |
| **structurally-fake** | No standard reserves it, so it is made *self-evidently* fake instead of plausible. | `TEST_Lastname_000142`, `TEST_COOKIE_ID_000142`, constrained UTM URLs | "Synthetic token; not derived from any real record." |

Stating which tier each field sits in is not a weakness to bury. It is the thing that separates a practitioner from a datasheet.

**Derived fields do not create a fifth tier.** For `sha256Email` and `sha256Phone`, the tier names
the known input's assurance basis and the field record separately names the SHA-256 derivation.
The digest itself is not reserved, is not visibly fake, and must not be treated as anonymous.
SafeSeed therefore accepts only its fixed digest allowlist rather than every string with the right
64-hex shape. Each hash field has 100 published source-to-digest pairs, so the default 100-row
presets stay unique; larger jobs cycle that bounded list instead of silently widening acceptance.

> **The 0.2.1 SSN correction.** SafeSeed 0.2.0 generated SSNs from the `900-999` area range on the theory that the SSA never assigns it — but that range is the IRS ITIN space (`9XX-XX-XXXX`), real issued identifiers, so the "no real holder has one" claim was false for those values. 0.2.1 generates only from components neither the SSA nor the IRS ever issues, narrows the reserved definition to match, and — by design — old 0.2.0 datasets and run records now **fail** `verify` and their `9xx` SSNs are **flagged** by `scan`. Details in [CHANGELOG.md](CHANGELOG.md). One nuance stated plainly: these values are format-*shaped* (`NNN-NN-NNNN`); a strict SSN validator that encodes issuance rules will reject them, and that rejection is exactly the safety property.

## What this does **not** prove

The fastest way to lose a security reviewer is to claim more than you can defend. So, on purpose:

- **The record declares provenance; it does not authenticate it.** The CLI and browser generator make the structural claim "generated without a production dataset, under catalog version X" because their generation path accepts no source records. The exported `makeRunRecord(dataset, csv)` API checks that each declared CSV field matches the supplied dataset and current catalog constraints, but a JavaScript object has no independently provable history. The record is unsigned, and anyone who can change both file and record can recompute both. `verify` provides drift evidence only when the record itself is independently protected or reviewed; it is not cryptographic proof of origin or of no PII.
- **"Not derived from production data" is not "not personal data."** The defensible claim is the former, never the latter.
- **Hashing is not anonymization.** A SafeSeed hash is useful because its known input came from the catalog path and the exact digest is allowlisted. A random SHA-256 value may still represent customer data and fails the catalog check.
- **It is a control, not a scope-out.** A security-of-processing and data-minimization control for non-production environments (GDPR Articles 25 and 32; SOC 2 and ISO 27001 in audit terms). It is not a DSAR answer and not a lawful-basis story.
- **It is deliberately low-fidelity.** Every phone sits in one small block, every IP in three documentation ranges. That is useful for enforcing a no-production-input fixture path, and wrong as your general fixture source, your ML training data, or your load-testing input.

## "Why not just use Faker?"

Off-the-shelf fake-data libraries already emit reserved-range values. What is missing is the *discipline* around them: every personal-data field tied to a cited standard, an enforcement check that fails the build when a value drifts out of range, a scan that flags real-looking data already sitting in your test environment, and an honest written statement of exactly what is and isn't guaranteed. That discipline is the contribution. The generator was never the hard part.

(SafeSeed can wrap Faker, by the way: keep it for realistic non-PII fields, and let the cited reserved ranges own every PII-shaped one.)

## Standards referenced

- **RFC 2606** — reserved DNS names (`example.com/.net/.org`, `.test`/`.example`/`.invalid`/`.localhost`).
- **RFC 5737** — IPv4 documentation blocks (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`).
- **RFC 3849** — IPv6 documentation prefix (`2001:db8::/32`).
- **NANPA / ATIS** — fictitious telephone numbers (`555-0100` through `555-0199`).
- **Ofcom** — [telephone numbers for TV and radio drama](https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama), including mobile `07700 900000` through `07700 900999`.
- **Google Ads enhanced conversions** — [normalization and lowercase hexadecimal SHA-256 format](https://support.google.com/google-ads/answer/13262500) for hashed email and phone match keys. SafeSeed uses that wire shape over its own catalog-constrained inputs; Google does not reserve the resulting digest namespace.
- **SSA SSN randomization** (effective 2011-06-25) — never-assigned components (area `000`/`666`, group `00`, serial `0000`), confirmed against the [SSA randomization rules](https://www.ssa.gov/employer/randomization.html). The `900-999` areas the SSA also excludes are **deliberately not used**: that space is the [IRS ITIN range](https://www.irs.gov/individuals/individual-taxpayer-identification-number) (`9XX-XX-XXXX`) — real, issued identifiers, with group ranges the IRS has expanded over time.
- Card numbers are **published processor/sandbox test PANs** (e.g. Stripe testing docs), in the `designated-test-only` tier. They pass Luhn and are intended for test mode; the designation, not mathematical impossibility, is the assurance source.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest (catalog/generate/presets/verify/scan/record)
npm run build       # emit dist/ (library + CLI)
```

The catalog in [`src/catalog.ts`](src/catalog.ts) is the reusable core: it maps each field type to its constraint, source, claim, and tier. Generation, verification, and scanning all read from it, which is what makes the promise auditable.

## Status

Core library, CLI, the strict whole-file `verify` Action, and an interactive browser generator are built and tested (124 unit tests, a six-case CLI boundary contract, and a five-case Action contract). SafeSeed 0.3.0 hardened scan, records, CI diagnostics, and the exact Action artifact. The local 0.4.0 candidate adds practical sales/marketing presets and catalog-constrained UK phones, UTM URLs, opaque IDs, and derived SHA-256 match keys without broadening scan to arbitrary lookalike values. Its repair pass also makes CSV parsing fail closed, rejects spreadsheet-triggering headers, removes arbitrary browser values, binds each download pair to one exact state, redacts browser diagnostics, and preserves the zero-runtime-dependency contract. See [CHANGELOG.md](CHANGELOG.md) for the release history.

The current browser-facing outputs owned by this repository are the committed, offline generator at [`demo/safeseed-generator.html`](demo/safeseed-generator.html) and the embedded proof bundle at [`demo/safeseed-proof.js`](demo/safeseed-proof.js). The live article at [advokatfrida.com/safeseed](https://advokatfrida.com/safeseed/) supplies its own theme-owned briefing and mounts separately copied theme assets. A local build is not live until that copy is explicitly synchronized, reviewed, and deployed; the current `0.4.0` candidate is intentionally not synchronized. [`demo/safeseed-demo.html`](demo/safeseed-demo.html) and [`demo/safeseed-proof.html`](demo/safeseed-proof.html) are legacy compatibility outputs retained only until a coordinated repository/theme retirement; neither is a current live entry point or approval target. The package is on [npm](https://www.npmjs.com/package/safeseed). The design record is in [SPEC.md](SPEC.md); the v2 feature spec is in [docs/generator-and-column-scoped-verify.md](docs/generator-and-column-scoped-verify.md).

## Support

Questions and reproducible bugs belong in [GitHub Issues](https://github.com/advokat-frida/safeseed/issues). Please read [SUPPORT.md](SUPPORT.md) before posting, and report suspected vulnerabilities privately through [GitHub's security form](https://github.com/advokat-frida/safeseed/security/advisories/new) instead of a public issue.

## License

[MIT](LICENSE).
