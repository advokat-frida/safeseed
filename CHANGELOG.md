# Changelog

## 0.4.0 — 2026-08-20

### Practical sales and marketing fixtures

- Added four editable schema presets in the core library, CLI, and browser generator:
  `crm-contacts`, `marketing-attribution`, `hashed-audience`, and `uk-contacts`.
- Added `opaqueId`, which produces cookie-safe, visibly fake identifiers such as
  `TEST_COOKIE_ID_000001` and `TEST_ACCOUNT_ID_000001`. An arbitrary UUID, click ID, cookie ID,
  or business identifier is outside the accepted catalog pattern.
- Added `marketingUrl`, a canonical HTTPS landing URL on `campaign.example.com` with an exact set
  of obvious `TEST_` UTM parameters. A reserved host does not bless arbitrary query strings;
  unexpected parameters, order changes, or non-test values fail scan and verify.
- Added `ukPhone`, using Ofcom's `07700 900000` through `07700 900999` drama block. Format-valid
  output uses E.164; obvious mode uses the UK national shape.
- Added `sha256Email` and `sha256Phone` for systems that validate SHA-256 marketing match keys.
  Each type is a fixed published allowlist of 100 digests of catalog-constrained inputs. The
  default 100-row presets stay unique; larger jobs cycle the bounded list. An arbitrary
  64-character hash fails. The field record names the derivation and states that the digest itself
  is neither reserved nor visibly distinguishable from a hash of customer data.
- Added `safeseed generate --preset <id>` and `safeseed presets`. A preset defaults to 100 rows,
  remains deterministic, and is still an ordinary editable schema.

### Contract and compatibility

- Catalog `4.0.0` adds structured constraints for Ofcom drama phones, SHA-256 allowlists, and
  marketing URLs. Generated values, `scan`, strict verify, and column-scoped verify continue to
  read from the same catalog predicate.
- Run records now carry optional per-field derivation text. SafeSeed `0.4.0` rejects older record
  contracts and asks for regeneration rather than silently applying new field claims to old
  evidence.
- The browser generator starts with the CRM preset, adds a compact practical-schema chooser and
  a conditional hashed-identifier boundary note, and keeps CSV plus verification-file download as
  the primary exit. No backend, data upload, account, analytics, or runtime dependency was added.

### Adversarial repair pass

- Removed arbitrary-value columns and the self-audit panel from the browser generator. Every browser
  output column now comes from the SafeSeed catalog; customer values and spreadsheet formulas have
  no input path on that screen.
- Made browser verification strict whole-file verification, matching the public GitHub Action.
  Added, removed, reordered, or edited columns fail instead of being reported beneath a green result.
- Bound each downloadable verification file to the exact current CSV state. Changing a seed, row
  count, name, type, or preset invalidates the prior record until the matching record finishes.
- Replaced the permissive CSV parser with fail-closed syntax checks. Unclosed quotes, quotes inside
  unquoted cells, and characters after a closing quote now fail `verify`, `scan`, and record creation.
- Added runtime validation for non-empty schemas, unique single-line field names, known field types,
  row counts from 1 through 100,000, and unsigned 32-bit seeds. Impossible or resource-exhausting
  values such as `Infinity` can no longer enter the generation loop.
- Capped schemas at 256 fields and column names at 256 characters, and replaced the opaque-ID
  prefix regex trimmer with explicit start/end index loops after hosted CodeQL found polynomial
  behavior on underscore-heavy caller input.
- Reject caller-controlled CSV headers whose first non-whitespace character is `=`, `+`, `-`, or
  `@`. Generation and run-record creation now stop before producing a spreadsheet-formula trigger.
- Made browser file reads and verification results newest-input-wins. A slow older file read or
  verification run can no longer overwrite the currently selected pair or paint a stale pass.
- Redacted browser verification candidates, raw fingerprints, and full submitted headers from
  human-facing failures. Repeated row-width failures are summarized instead of printing one line
  per row.
- Removed accidental runtime dependencies from the npm manifest and added a release assertion that
  both package and root lockfile keep the zero-runtime-dependency contract.
- Made the portable generator use system-font fallbacks so direct `file://` use makes no missing-font
  requests; extended the fallback to the legacy showcase and proof outputs; added a real
  no-JavaScript explanation, functional skip target, contextual control names, and strict 4px/999px
  family radius grammar.
- Tightened proof-table spacing at the article breakpoint so the exact embed fits its 760px host
  column without hidden horizontal clipping while retaining the mobile card layout.
- Made every public demo and standalone build compile the package core before Vite consumes
  `dist/index.js`; the release-alignment check now rejects scripts that can rebundle stale core
  bytes.

## 0.3.0 — 2026-08-18

### Named-column scans now fail closed

- `scan` no longer returns a clean result when a requested column is absent. Missing named columns
  are reported and make the command exit nonzero.
- Header matching is case-insensitive after trimming surrounding whitespace and a leading UTF-8
  byte-order mark, so `Email`, ` email `, and `email` resolve to the same requested field.
- Duplicate matching headers are reported as ambiguous and are not silently resolved to whichever
  copy happened to appear last.
- Non-rectangular CSV rows now fail scan instead of letting unheadered trailing cells disappear.
- Email, phone, SSN, card, domain, and IPv6 catalog checks reject malformed/composite cells instead
  of stripping arbitrary text until a reserved-looking suffix remains. The entire `9xx` taxpayer-ID
  space is excluded even when another SSN-shaped component is `00` or `0000`.
- The library's `ScanResult` now includes `missingColumns` and `duplicateColumns`; the CLI prints a
  distinct diagnostic for each, plus `malformedRows` for width failures.

This is intentionally observable behavior. A pipeline whose `--fields` list contains a typo may
start failing under 0.3.0; that previous pass was a false clean, not compatibility worth preserving.
The reserved ranges remain byte-compatible with catalog 2.0.0 and generated CSV bytes are unchanged
for the same schema and seed. Run-record compatibility is intentionally stricter: regenerate older
records under the exact 0.3 contract before verification.

### Assurance language now matches the actual control

- Catalog `3.0.0` replaces the overbroad `provably-non-real` and `reserved-not-issued` labels with
  `protocol-reserved` and `authority-reserved`. The underlying 2.0.0 ranges do not change.
- Protocol, authority, and payment-card claims now state the reservation or test designation they
  can support. They no longer infer that no infrastructure could handle a value, that an authority
  policy is permanent, or that coincidence with real-world data is impossible.
- New run records carry the corrected tier names and claim text. The 0.3 verifier rejects older
  record contracts and asks for regeneration rather than trusting legacy metadata, optional
  column hashes, or the overbroad attestations those records carried.
- README, specification, essay, CLI record, and browser UI now share the same narrower boundary:
  SafeSeed's generator ingests no production dataset, while every output field keeps its own
  versioned assurance tier.
- Run records now say plainly that provenance is an unsigned caller declaration, not an
  authenticated history. `makeRunRecord` rejects obsolete catalogs, out-of-range declared values,
  malformed datasets, and declared fields that do not match the supplied CSV; it still cannot
  prove how a structurally supplied JavaScript object was created.
- Hash comparison is now described as drift evidence only when the record is independently
  protected or reviewed. Anyone able to replace both file and unsigned record can recompute both.

### The GitHub Action is now an exact release artifact

- The Action runs the committed SafeSeed CLI through GitHub's managed Node 24 Action runtime on
  Linux, Windows, and macOS. It no longer calls `npx`, downloads `safeseed@latest`, or depends on a
  caller-installed Node version.
- Workflow inputs are passed as process arguments without a shell. The public Action is deliberately
  strict-only: any added column fails, while partial column-scoped attestation remains available in
  the CLI and library under its explicitly narrower contract.
- Verifier output is treated as untrusted data. The wrapper disables GitHub workflow-command
  processing with synchronously written markers and a fresh random token while the CLI runs, then
  restores it before emitting its own escaped annotations, preventing CSV or record text from
  injecting runner commands even when the inherited output pipe is backpressured.
- Direct CLI diagnostics are single-line/control-escaped, and candidate values are redacted by
  default so CI scanning does not copy suspected personal data into durable logs. The library still
  returns values to local programmatic callers.
- The old `version` input has been removed. A SafeSeed tag or commit SHA now identifies both the
  wrapper and the CLI bytes it executes; there is no second package version hiding underneath it.
- CI includes a five-case local wrapper contract plus real `uses: ./` consumer jobs for clean,
  strict-failure, legacy-relaxation rejection, and workflow-command quarantine across all three
  hosted operating systems.
- Tracked CSV fixtures are pinned to LF so the Action's exact-byte record hash remains stable across
  Git checkouts on Windows, Linux, and macOS. Consumer documentation makes the same line-ending
  requirement explicit instead of silently normalizing integrity evidence.

### Release and project hardening

- Raised the runtime floor to supported Node 22+; the core CI gate now runs on Node 22 while the
  bundled Action and protected release path use Node 24. The former Node 18 claim depended on a
  global Web Crypto API that was still flag-gated in that release line.
- CLI generation and scanning validate config/field schemas, including unique names, known types,
  and control-free column names, before they write or inspect data; an invalid schema no longer
  leaves a CSV without its requested record or injects a runner command through a streamed header.
- Added a release-alignment check covering package, lockfile, source, generated record, compiled
  CLI, changelog, README example, and Action metadata versions.
- Added confidential vulnerability-reporting and public support guidance. The Action documents its
  no-network, no-secret, no-write-permission runtime boundary.
- Pinned the repository's own workflow dependencies to full commit SHAs and added dependency-audit,
  committed-build freshness, package dry-run, and Action-contract gates.
- Added CodeQL analysis for JavaScript and TypeScript on pull requests, `main`, and a weekly schedule.
- Replaced the stored npm publish token with npm trusted publishing: an unprivileged job verifies
  and hashes the exact tarball, an immutable workflow artifact carries it across the protected
  `npm` environment, and a minimal job publishes it with a short-lived OIDC credential and
  automatic provenance. The OIDC-capable job installs no dependencies and disables package
  lifecycle scripts. Publishing begins only after a stable GitHub Release is published.
- Repaired the root and browser-demo lockfiles for the current `nanoid` and `postcss` advisories.
- Standardized the browser demo and generator against the Advokat Frida tool chrome, improved mobile
  and accessibility behavior, tightened scanner honesty copy, and added self-referencing canonicals.

## 0.2.1 — 2026-07-01

### The SSN range was wrong: it collided with real ITINs. Fixed, breaking, on purpose.

**What was wrong.** SafeSeed 0.2.0 generated SSNs from the `900-999` area range and treated that whole range as reserved, on the theory that the SSA never assigns it. The SSA part is true — but `9XX-XX-XXXX` is the IRS **ITIN** space: Individual Taxpayer Identification Numbers, real identifiers issued to real people, with group ranges (`50-65`, `70-88`, `90-92`, `94-99`) the IRS has expanded over time. Roughly a third of the SSNs SafeSeed 0.2.0 generated matched live ITIN patterns. Two claims failed at once: the README's "never assigned, so no real holder has one" was false for those values, and `scan` would pass a column of genuine ITINs as clean.

**What changed.**

- **Generation** now emits only SSN-shaped values containing a component the SSA marks invalid:
  a plausible-looking area in `001-899` (never `666`, never the `9XX` ITIN space) with group
  forced to `00` or serial forced to `0000`. Values stay format-shaped (`NNN-NN-NNNN`) and
  deterministic per seed; excluding the entire `9XX` area keeps this generator out of ITIN
  territory even if the IRS expands its ITIN group ranges again.
- **The reserved definition** (catalog `1.0.0` → `2.0.0`) narrows to exactly: area `000`, area `666`, group `00`, serial `0000`. Areas `900-999` are no longer reserved.
- **Consequently, `scan` now flags `9xx`-area SSNs as candidate real PII — including SafeSeed 0.2.0's own output.** That is correct and is the point: those values can belong to real ITIN holders.
- **Old run records fail `verify` by design.** A 0.2.0 dataset with `9xx` SSNs fails the range check under catalog 2.0.0; `verify` now also emits a warning whenever a record's `catalogVersion` differs from the current catalog, naming the ITIN correction, so the failure is explained rather than mysterious. There is deliberately **no compatibility mode** that re-blesses the old range. Regenerate your fixtures and records with 0.2.1.
- **Claim language tightened.** "Format-valid" for SSNs means the *shape* passes (`\d{3}-\d{2}-\d{4}`). A strict SSN validator that encodes the issuance rules will reject group-`00`/serial-`0000` values — and that rejection is precisely the safety property. The catalog, README, docs, and demo prose now say this instead of implying validator-proof output.
- Non-SSN fields are byte-identical to 0.2.0 for the same seed (the SSN generator consumes the same number of RNG draws), so only the `ssn` column changes in regenerated fixtures.

### Also in this release

- **Demo:** the showcase's "Open the generator" link pointed at `./generator.html`, which 404s on the live site; it now points at the committed single-file name `./safeseed-generator.html`.
- **Scan honesty, stated where you read it:** the README scan section, the CLI's clean-scan output, and `--help` now say the limitation out loud — scan flags real data *outside* reserved ranges; real data that happens to look reserved (a real mailbox at `example.com`, a real `555-01xx` line, a genuine ITIN under the old range) is not flagged. Clean means "nothing provably-unreserved found," not "no real PII."
- **CLI:** `--seed` has always silently defaulted to `0` (a no-seed run is deterministic, on purpose). Now documented in `--help` and the README instead of being a surprise.
- **GitHub Action:** inputs are passed to the `run:` script via `env:` and quoted shell variables instead of `${{ }}` interpolation into the script body — template-injection hardening, no functional change.
- **Demo copy:** count-aware pluralization in the scan summary ("1 row" / "N rows") and the generator's custom-columns note ("Your 1 column rides along … is not attested").
- Committed example fixtures (`examples/`) regenerated with the corrected generator; the dirty-legacy scan example now demonstrates the ITIN catch (its `900-12-3456` row is flagged, as it should be).

## 0.2.0 — 2026-06

- Per-column hashes in run records and opt-in column-scoped verify (`--allow-added-columns`).
- Self-serve browser generator page; four-tier honesty taxonomy (protocol-reserved vs authority-reserved vs designated-test vs structurally fake).

## 0.1.0

- Initial release: generate / attest / verify / scan from the cited reserved-range catalog.
