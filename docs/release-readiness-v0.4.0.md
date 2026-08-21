# SafeSeed 0.4.0 local repair and release-readiness receipt

Date: 2026-08-21
Base revision: `f6fefc822c1037e00e170711653c77cdd46deacf`
Candidate state: draft PR #7 on `codex/advo-155-safeseed-040-hardening`

## Release boundary

This receipt covers a committed `0.4.0` review candidate. It is not evidence of a push, hosted CI,
GitHub Release, website synchronization, deployment, npm publication, or production change. The
commit, branch push, draft PR, and Linear review record were authorized by the 2026-08-21 tuck; no
public release action was authorized or performed.

Live state re-read on 2026-08-21: npm still serves `0.2.1`; Git contains tags `v0.2.0` and
`v0.2.1`; no GitHub Release exists. The unpublished `0.3.0` hardening work is the base for this
candidate, not a public release.

## Candidate scope

- Catalog `4.0.0`: Ofcom drama mobile numbers, constrained marketing URLs, visibly fake opaque
  business/cookie IDs, and fixed 100-value SHA-256 email/phone allowlists derived only from
  catalog-constrained inputs.
- Four inspectable schema presets in the library, CLI, and browser generator.
- Run-record derivation metadata and fail-closed incompatibility with older records.
- Strict CSV grammar in generation, scan, verify, and record construction.
- Runtime limits cap schemas at 256 fields, column names at 256 characters, rows at 100,000, and
  seeds at unsigned 32-bit values; formula-triggering caller headers are rejected before output.
- Browser generation restricted to catalog fields, strict exact-pair browser verification,
  newest-input-wins file handling, redacted failure diagnostics, and exact-state CSV/record
  download binding.
- Zero runtime dependencies in the npm package and portable browser outputs that make no
  external-origin request when opened directly.
- No Ghost article copy, theme mutation, website sync, deployment, package publication, GitHub
  release, telemetry, backend, account, or production-data input path.

## Source and claim review

- Ofcom source: `07700 900000` through `07700 900999`, recommended for drama and not allocated to
  providers in the foreseeable future.
- Google Ads source: normalized email/phone match keys use lowercase hexadecimal SHA-256; SafeSeed
  applies that wire shape only to its published catalog-constrained input allowlists.
- RFC 2606 source: `example.com` is reserved for documentation/examples. Marketing URL checks also
  constrain the full path, exact parameter set, order, and `TEST_` values; the host alone is not a
  pass condition.
- RFC 6265 cookie-value grammar check: generated opaque IDs use allowed visible ASCII and stay
  visibly fake through a `TEST_` prefix. SafeSeed does not intentionally emit an invalid cookie.
- Hashed-field copy states that a digest is neither anonymous, reserved, nor visibly fake. An
  arbitrary 64-character hash fails.

## Automated and packaging checks

- Root `npm.cmd run release:check`: pass.
- TypeScript: pass in the root release check and demo production/standalone builds.
- Unit suite: 127 of 127 pass across 10 files.
- CLI boundary contract: 6 of 6 pass, including formula-header rejection, preset round trip, and
  malformed-CSV fail-closed behavior.
- Local Action contract: 5 of 5 pass, including strict added-column drift and redacted output.
- Root and demo dependency audits: zero known vulnerabilities at the configured moderate threshold.
- Root build, compiled Action path, generated fixture alignment, and version alignment: pass.
- Package dry run: 59 entries, 62,936 packed bytes, 234,029 unpacked bytes, and zero files outside
  `dist/**`, `README.md`, `LICENSE`, and `package.json`.
- `package.json` and the root lockfile contain zero runtime dependencies. The final disposable
  consumer install also contains no runtime dependency tree.
- Root `dist/` plus every generated hosted, standalone, embed, and committed browser output retained
  identical SHA-256 hashes across a complete second root-first build: 76 of 76 files matched.
- The first hosted PR run passed the build, CodeQL analysis job, and Ubuntu, Windows, and macOS
  Action contracts, but GitHub's result gate found one high-severity polynomial-regex alert in the
  opaque-ID prefix normalizer. A first split-regex attempt remained red because the trailing end-
  anchored repetition could still backtrack quadratically. The final repair removes regex trimming in favor of explicit
  start/end index loops, caps schemas at 256 fields and names at 256 characters, and adds direct
  regression tests. A clean
  follow-up hosted CodeQL result remains mandatory before merge.

## Browser behavior and adversarial checks

The exact rebuilt `demo/safeseed-generator.html` was exercised through direct `file://` navigation.
The only request was the document itself; no console error or page error occurred.

- A forced slow SHA-256 digest kept both download controls disabled until the current verification
  record finished. The downloaded CSV's recomputed SHA-256 exactly matched the downloaded record's
  `contentSha256` and seed.
- The untouched CSV/record pair produced `Verified`. An added column failed strict verification.
  An unclosed quoted field failed as malformed CSV. Failure copy exposed no submitted candidate
  value, full submitted header, or raw 64-character fingerprint.
- Repeated row-width failures collapse to one count instead of one diagnostic per row.
- Forced slow file reads proved newest CSV and newest record selection wins. A pending verification
  result cannot replace the state of a newer pair.
- Invalid row count, seed, and spreadsheet-triggering header states block downloads and expose
  `aria-invalid`; the header value itself is not echoed in the error.
- There is no arbitrary/custom-value option, self-audit panel, or browser partial-verification mode.
  The browser accepts only catalog-generated columns and strict verification.
- The generator had no document overflow at 1440, 761, 760, 621, 620, 390, or 320 pixels. The
  failure state also fit 390 and 320 pixels after raw-fingerprint redaction and wrapping repairs.
- With JavaScript disabled, the page presents a readable purpose/privacy boundary, keeps the skip
  target functional, and does not expose inert tool controls. The no-JavaScript desktop and mobile
  states made no external request and did not overflow.

## Literal visual inspection

Manual visual verdict: pass for the local candidate. Evidence is under
`C:\Users\Ben\.codex\visualizations\2026\08\21\01a021ac-8460-70a3-9484-eb75b78a8b4f\safeseed-repairs-qa`.
Every captured file was opened and inspected at literal size, including:

- generator default, hashed-field warning, invalid formula header, completed download state,
  strict pass, added-column failure, redacted-value failure, and malformed-CSV failure at desktop;
- generator default, stacked fields, invalid formula, and failure at 390px; default at 320px;
- no-JavaScript generator at 1440px and 390px;
- legacy showcase and standalone proof at desktop/full-page/mobile;
- the exact `safeseed-proof.js` bundle mounted in a 760px article column at 840px viewport and in
  its 390px mobile host.

The generator hierarchy, selected state, disabled/error treatment, pass/fail distinction, and
mobile field order remained clear. The legacy and proof compatibility outputs remained readable
with system-font fallbacks and no missing-font request. The first article-width proof build exposed
12px of hidden table overflow (`666px` content in a `654px` container); the repaired final build
measures `654px` inside `654px` for both tables, with no document overflow. Mobile proof tables
continue to use readable cards.

The Advokat Frida style-bible validator passes for
`website/docs/style-bible-receipts/safeseed-v0-4.json` with family `standalone-shell` and patterns
`zippy`, `outcome-receipt`, and `field-note`. The receipt itself still contains pre-repair references
to a browser audit control that this candidate intentionally removed; because website files were
outside this repair boundary, that narrative reconciliation remains a pre-release gate.

## Final reproducibility and consumer proof

The first final-order reproducibility run correctly failed: the browser files had been built before
the latest root `dist/` compile even though the Vite alias deliberately consumes `dist/index.js`.
The ordered rebuild changed 13 generated files, proving the previous browser bytes were stale. After
rebuilding root first, the identical root + hosted demo + four standalone build chain was run again;
all 76 generated files retained identical SHA-256 hashes.

The reconciled tarball is `safeseed-0.4.0.tgz`, SHA-1
`e88d761f20d037ee2474d4181f0bec548da0657e`, with 59 entries, 62,936 packed bytes, and 234,029
unpacked bytes. It was packed directly into the new disposable consumer directory
`C:\Users\Ben\AppData\Local\Temp\safeseed-consumer-final-codeql-20260821-063553`; no tarball was left in
the source tree.

That consumer installed exactly one package with lifecycle scripts disabled. Its lockfile contains
only the consumer root and `node_modules/safeseed`; the installed SafeSeed manifest has zero runtime
dependencies; `node_modules` totals 236,056 bytes including the npm lock and command shim. The
installed CLI reports `safeseed 0.4.0 (catalog 4.0.0)`. The public API generated a seven-row
`crm-contacts` dataset, created a record, verified the exact CSV, and rejected a caller-controlled
` =danger` header, a 257-character column name, and a 257-field schema.

## Website drift and hosted evidence

`node website/sync-safeseed-assets.mjs --check` was run read-only after the repair build. It reports
all three copied browser assets as drifted: `safeseed-demo.html`, `safeseed-generator.html`, and
`safeseed-proof.js`. No `--apply` synchronization was authorized or performed, so the repaired
generator and proof are not live.

Still required before any public release:

- Ben's product review and explicit release authority.
- Final reviewed commit SHA and hosted CI URL.
- Ubuntu, Windows, and macOS hosted Action-contract runs.
- Full-SHA disposable consumer-repository proof.
- Authorized website synchronization, literal hosted proof, and deployment review.
- Tag, GitHub Release, protected npm environment approval, and publication authorization.

Follow `PUBLISH-CHECKLIST.md`; do not infer one gate from another.
