# Spec: Self-serve generator + column-scoped verify

Status: **built** (2026-06-24), security boundary amended 2026-08-18. Owner: Ben. Scope: SafeSeed v2 feature.

As built, matching this spec: per-column `sha256` in the run record (SafeSeed 0.2.0,
additive — 0.1.0 records still verify strictly); opt-in CLI/library column-scoped verify
(`verify --allow-added-columns`) that attests declared columns by name + per-column hash +
range and reports added columns as `unattestedColumns`; new failure kinds `missing-column`
and `column-hash-mismatch`; strict whole-file verify unchanged and still the default. The
public GitHub Action is intentionally strict-only, so a green Action result always covers
the entire file. Self-serve generator page
(`demo/generator.html` + `demo/src/generator/`) with a field picker, row count, seed,
live tier-colored preview, and CSV + run-record download; builds hosted (multi-page)
and as a standalone single file (`demo/safeseed-generator.html`). CI dogfoods both CLI
modes and separately proves that the Action cannot be relaxed.

## Goal

Turn SafeSeed from a showcase into a tool a **non-technical team (marketing, education)** can
use themselves: generate auditable, catalog-constrained test data, and extend it with their own
business columns (job title, industry, role) **without breaking attestation**.

Two parts:

1. **Dedicated generator page** — a real self-serve UI: choose fields + types, set row count and
   seed, preview, and download the **CSV + its run record**. Client-side, no data upload or
   external-origin request, with the same strict CSP as the demo. The existing demo stays a
   credibility showcase; this is the working tool.
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
  is explicit opt-in (`verify --allow-added-columns`), so the narrower scoped contract is never silent.
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
  - SafeSeed 0.3 requires the current record contract and a per-column hash for every declared
    field. Older records must be regenerated; column-scoped verification never silently downgrades
    to range-only.
- **CLI (`cli.ts`)** — `verify --allow-added-columns`; correct exit codes.
- **Action (`action.yml`)** — strict whole-file verification only. Column-scoped attestation is
  deliberately unavailable on this public pass/fail surface.
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
- `verify.columnScoped.failsOnOutOfRangeInDeclaredColumn` — out-of-range value in a declared column → fail.
- `verify.columnScoped.reportsUnattestedColumns` — added columns listed.
- `verify.strictRemainsDefault` — default verify unchanged; an added column still fails (regression guard).

Round-trip:
- generator output (CSV + record) passes plain `verify`; after adding a column, passes
  `--allow-added-columns` and fails plain `verify`.

CLI/CI:
- dogfood `verify --allow-added-columns` on a committed fixture-with-extra-column (must pass) and a
  tampered synthetic column (must fail).
- run the bundled Action on Linux, Windows, and macOS; added-column drift must fail even if a caller
  supplies the retired `allow-added-columns` input name.

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
2. CLI flag + CI dogfood. The original Action input was retired for the 0.3.0 candidate so Action
   success has one unambiguous, whole-file meaning.
3. Generator page (configurable UI + export), wired to the core.
4. Docs + honesty framing.
