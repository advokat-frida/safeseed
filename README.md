# SafeSeed

**Confirmably-synthetic test data by construction.** Generate stand-in data for test, CI, and demo environments from ranges that published standards have reserved as *permanently not real*, bind a tamper-evident record to the output, verify a file stays in range, and scan data you already have for real PII that slipped in.

No model, no training data, no backend, no accounts, no telemetry, zero runtime dependencies. It runs entirely on your machine. MIT licensed.

> SafeSeed makes *"no production data crossed this boundary"* a property you can audit once and enforce on every run — and it tells you, in writing, exactly where that guarantee ends. The full argument is in [docs/safe-test-data-by-construction.md](docs/safe-test-data-by-construction.md).

---

## Why this exists

The breaches teams plan for involve production. The ones that actually happen often involve a *copy* of production sitting somewhere nobody hardened: a staging database, a CI job's fixtures, a developer's laptop, a screenshot in a bug ticket. The fix everyone agrees on is "don't put real data there, use synthetic data." The disagreement is about what "synthetic" should mean.

Most synthetic-data tools **learn the shape of your real data from your real data**, so the output can memorize and re-emit real records, and privacy becomes something you defend *after the fact* (membership-inference tests, differential-privacy noise, a privacy report) on every dataset, forever.

SafeSeed takes the other path: **never let real data into the process at all.** Each field is drawn from values a standard reserves as non-real. If the source data never touches the generator, there is no real record for it to memorize or re-emit — not because you defended it after the fact, but because the input was never there. You audit a few hundred cited lines once, and every output inherits the guarantee. (This is the argument against model memorization; the structurally-fake tier still carries the coincidence caveat below.)

## What it does

1. **Generate** safe-by-construction test data from the cited reserved ranges (deterministic from a seed, so the output is a committable fixture).
2. **Attest** with a tamper-evident run record that binds to the file's content hash and states the honesty tier of every field.
3. **Verify** that a file is still byte-for-byte the generated one *and* that every value is still in range — wire it into CI to fail the build on drift.
4. **Scan** an *existing* CSV / seed file and flag values that are not in reserved ranges as candidate real PII.

`verify` and `scan` are **generator-agnostic**: they work on any data file, however it was produced, so you can keep the generator you already use and wrap it.

## Quickstart

### CLI

```bash
# Generate 100 rows of safe data + a run record
safeseed generate \
  --fields email:email,name:fullName,phone:phone,ssn:ssn,card:creditCard \
  --rows 100 --seed 42 \
  --out data.csv --record record.json

# Fail the build if the file drifts out of range or was tampered with
safeseed verify --in data.csv --record record.json     # exit 0 clean, 1 on drift

# Scan a legacy file for real PII that slipped in
safeseed scan --in legacy.csv --fields email:email,phone:phone,ssn:ssn

# Inspect the reserved-range catalog (every field's range, citation, and tier)
safeseed catalog
```

### As a CI gate (GitHub Action)

```yaml
- uses: <org>/safeseed@v0      # the verify Action
  with:
    data: fixtures/seed.csv
    record: fixtures/seed.record.json
```

### As a library

```ts
import { generate, toCsv, makeRunRecord, verify, scan } from "safeseed";

const ds = generate({
  schema: [
    { name: "email", type: "email" },
    { name: "phone", type: "phone" },
  ],
  rows: 100,
  seed: 42,
});
const csv = toCsv(ds.columns, ds.rows);
const record = await makeRunRecord(ds, csv);

const result = await verify(csv, record); // { ok, failures, checked }
```

The library is isomorphic — the same core runs in Node (>=18) and in the browser, using the platform's Web Crypto for hashing.

## The honesty tiers

Honesty is the credibility here, so the claim has tiers, and every field is labeled with its own:

| Tier | What it means | Examples | The claim |
|---|---|---|---|
| **provably-non-real** | Reserved by a published standard; cannot belong to a real person or system. | RFC 2606 email domains, RFC 5737 / 3849 IPs, NANPA `555-01xx` phones, unassigned SSN ranges | "Cannot correspond to a real person or system." |
| **designated-test-only** | A valid-looking value processors/sandboxes *designate* for testing. It passes validation. | Card test PANs (`4242…`) | "Non-real by designation, **not** by impossibility." |
| **structurally-fake** | No standard reserves it, so it is made *self-evidently* fake instead of plausible. | `TEST_Lastname_000142`, `123 Example Way` | "Synthetic token; not derived from any real record." |

Stating which tier each field sits in is not a weakness to bury. It is the thing that separates a practitioner from a datasheet.

## What this does **not** prove

The fastest way to lose a security reviewer is to claim more than you can defend. So, on purpose:

- **It attests the generator, not your environment.** "Generated from reserved ranges, no real input" is true at the moment of generation. It says nothing about a file someone later edits, joins against a prod snapshot, or replaces. That is why `verify` re-checks the *actual artifact* (content hash + range), and why the assurance rests on the open, auditable code — a signature proves the tool ran, not that the tool is right. The run record is therefore a **tamper-evident record**, not "cryptographic proof of no PII."
- **"Not derived from production data" is not "not personal data."** The defensible claim is the former, never the latter.
- **It is a control, not a scope-out.** A security-of-processing and data-minimization control for non-production environments (GDPR Articles 25 and 32; SOC 2 and ISO 27001 in audit terms). It is not a DSAR answer and not a lawful-basis story.
- **It is deliberately low-fidelity.** Every phone in one small block, every IP in three ranges. That is correct for "prove there's no real PII in functional and CI tests," and wrong as your general fixture source, your ML training data, or your load-testing input.

## "Why not just use Faker?"

Off-the-shelf fake-data libraries already emit reserved-range values. What is missing is the *discipline* around them: every personal-data field tied to a cited standard, an enforcement check that fails the build when a value drifts out of range, a scan that flags real-looking data already sitting in your test environment, and an honest written statement of exactly what is and isn't guaranteed. That discipline is the contribution. The generator was never the hard part.

(SafeSeed can wrap Faker, by the way: keep it for realistic non-PII fields, and let the cited reserved ranges own every PII-shaped one.)

## Standards referenced

- **RFC 2606** — reserved DNS names (`example.com/.net/.org`, `.test`/`.example`/`.invalid`/`.localhost`).
- **RFC 5737** — IPv4 documentation blocks (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`).
- **RFC 3849** — IPv6 documentation prefix (`2001:db8::/32`).
- **NANPA / ATIS** — fictitious telephone numbers (`555-0100` through `555-0199`).
- **SSA SSN randomization** (effective 2011-06-25) — never-assigned ranges (area `000`/`666`/`900-999`, group `00`, serial `0000`), confirmed against the [SSA randomization rules](https://www.ssa.gov/employer/randomization.html).
- Card numbers are **published processor/sandbox test PANs** (e.g. Stripe testing docs), in the `designated-test-only` tier (they pass Luhn, authorize nowhere).

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest (the named TDD suite: catalog/generate/verify/scan/record)
npm run build       # emit dist/ (library + CLI)
```

The catalog in [`src/catalog.ts`](src/catalog.ts) is the reusable core: it maps each field type to its reserved range, citation, and tier. Generation, verification, and scanning all read from it, which is what makes the promise auditable.

## Status

Core library, CLI, and the `verify` Action are built and tested. A browser demo and npm publication are next. The design record is in [SPEC.md](SPEC.md).

## License

[MIT](LICENSE).
