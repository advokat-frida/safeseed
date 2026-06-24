# Spec: Self-serve generator + column-scoped verify

Status: proposed (awaiting go). Owner: Ben. Scope: SafeSeed v2 feature.

## Goal

Turn SafeSeed from a showcase into a tool a **non-technical team (marketing, education)** can
use themselves: generate safe, confirmably-synthetic test data, and extend it with their own
business columns (job title, industry, role) **without breaking attestation**.

Two parts:

1. **Dedicated generator page** — a real self-serve UI: choose fields + types, set row count and
   seed, preview, and download the **CSV + its run record**. Client-side, zero network, same
   strict CSP as the demo. The existing demo stays a credibility showcase; this is the working tool.
2. **Column-scoped verify** — an opt-in verify mode that attests only the *declared synthetic
   columns* and treats added columns as out-of-scope (reported, not failed). Strict whole-file
   verify stays the default. Pairs with **scan**: verify vouches for the synthetic columns, scan
   checks the columns the team added.

## Locked decisions

- **Per-column hashes.** The run record stores a `sha256` per field (over a canonical serialization
  of that column). Column-scoped verify recomputes and compares each declared column's hash + range
  — so it catches an in-range swap of a synthetic value, not just out-of-range. Added columns are
  reported as **unattested**, never a pass-blocker.
- **Strict by default.** Plain `verify` is unchanged (whole-file content hash + range). Column-scoped
  is explicit opt-in (`verify --allow-added-columns`), so the relaxed guarantee is never silent.
- **Honest framing.** Column-scoped verify attests the synthetic columns only; it does *not* vouch
  for columns the team added — those must be scanned. Stated in the UI and docs.

## Touched surfaces

- **Core (`src/`)**
  - `record.ts` — add per-column `sha256` to each field (record schema bump; version note).
  - `verify.ts` — column-scoped mode (`{ allowAddedColumns: true }`): match columns by header name
    (order-independent), per-column hash + range per declared column, list unattested columns. New
    failure kinds: `missing-column`, `column-hash-mismatch`. New result field: `unattestedColumns`.
  - `csv.ts` / a small helper — canonical per-column extraction + hashing.
  - `types.ts` — record + verify type updates.
  - Backward compat: a record without per-column hashes → column-scoped falls back to range-only for
    those fields with a clear warning; new `generate` always emits them.
- **CLI (`cli.ts`)** — `verify --allow-added-columns`; correct exit codes.
- **Action (`action.yml`)** — `allow-added-columns` input wired to the flag.
- **Generator page** — new entry in the demo app (`generator.html` + `src/generator/`), reuses the
  core + shared styles. Field picker (add/remove, type, name), row count, seed, live tier-colored
  preview, **Download CSV** + **Download run record**. Builds hosted + standalone single-file.
- **Docs** — README + this spec; the demo may link to the generator.

## Tests (named up front — TDD)

Core:
- `record.includesPerColumnHashes` — every field carries a stable sha256; deterministic per seed.
- `verify.columnScoped.passesWithAddedColumns` — generated file + an extra business column → PASS,
  extra column reported unattested.
- `verify.columnScoped.failsOnMissingDeclaredColumn` — drop a synthetic column → fail (missing-column).
- `verify.columnScoped.failsOnInRangeEditToSyntheticColumn` — swap a synthetic cell for another
  in-range value → fail (column-hash-mismatch). *(the per-column-hash payoff)*
- `verify.columnScoped.failsOnOutOfRangeInDeclaredColumn` — real value in a synthetic column → fail.
- `verify.columnScoped.reportsUnattestedColumns` — added columns listed.
- `verify.strictRemainsDefault` — default verify unchanged; an added column still fails (regression guard).

Round-trip:
- generator output (CSV + record) passes plain `verify`; after adding a column, passes
  `--allow-added-columns` and fails plain `verify`.

CLI/CI:
- dogfood `verify --allow-added-columns` on a committed fixture-with-extra-column (must pass) and a
  tampered synthetic column (must fail).

## Acceptance

- A user generates data, adds a non-PII column, runs `verify --allow-added-columns` → PASS with the
  added column flagged unattested; plain `verify` → FAIL (drift).
- Generator page: pick fields + rows + seed, preview, download CSV + record; the pair round-trips
  through verify; network counter stays 0.
- UI/docs make the synthetic-only scope of column-scoped verify explicit.

## Out of scope (v1)

- Non-CSV formats (JSON/NDJSON/SQL) — separate roadmap item.
- Faker integration for realistic non-PII columns.
- Saved/shareable generator configs, auth, accounts.
- Auto-detecting column-scoped mode (stays explicit opt-in).

## Build order

1. Core: per-column hashes in record + column-scoped verify (TDD, the named tests).
2. CLI flag + Action input + CI dogfood.
3. Generator page (configurable UI + export), wired to the core.
4. Docs + honesty framing.
