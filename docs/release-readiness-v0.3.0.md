# SafeSeed 0.3.0 release-readiness receipt

Date: 2026-08-18
Base revision: `8a7eb943f157343e8cfe9724ddf5198166f0360f`
Candidate state: local working tree only

## Release boundary

This receipt covers the local `0.3.0` candidate. It is not evidence of a commit, push, hosted CI
run, disposable-repository consumer proof, GitHub Release, or npm publication. Those remain
separate release gates.

## Automated checks

- Root audit: zero known vulnerabilities at moderate or higher severity.
- TypeScript: clean.
- Unit suite: 88 of 88 passing.
- CLI boundary contract: three of three passing. Candidate cell values are redacted, control text
  cannot become a runner command, invalid duplicate schemas leave no partial output, and
  control-bearing generate/scan schemas are rejected before CSV reaches stdout.
- Local Action contract: five of five passing, including proof that the retired relaxed input
  cannot bypass strict whole-file verification and hostile verifier output stays redacted inside a
  synchronous, unpredictable `stop-commands` envelope.
- Root build and release-alignment check: passing.
- Demo audit: zero known vulnerabilities at moderate or higher severity.
- Demo production and standalone builds: passing.
- Package dry run: 55 files, 43,412-byte tarball; only `dist/**`, `README.md`, `LICENSE`, and
  `package.json`. SHA-256:
  `8eb14bdbde37ab785eecfc39c61874200ceccf5e544f561ac63b11659882260f`.
- Exact tarball handoff and `npm publish --dry-run --ignore-scripts`: passing. The local dry run
  intentionally omits provenance because the short-lived OIDC identity exists only in the protected
  hosted release job.
- Clean local consumer install from that tarball: library import/generate/record/verify and CLI
  version smoke checks passing.
- Deterministic rebuild: all four committed browser artifacts reproduced their pre-build SHA-256.
- `action.yml`, CI, CodeQL, and release workflows: all four parsed as YAML during candidate review.
- Release authentication design: npm trusted publishing over short-lived OIDC; no stored publish
  token. The unprivileged verification job builds and hashes the tarball, while the protected job
  verifies that exact artifact and publishes with dependency installation and lifecycle scripts
  disabled.

Final local rerun completed after the implementation and artifact diff on 2026-08-18. These
results still describe a local candidate, not hosted evidence, and must not be treated as
evergreen.

## Browser compatibility verification

The four committed browser outputs were served over local HTTP with the Advokat Frida font assets
available. This pass checked engineering compatibility and claim containment at literal `1440x900`
and `390x844`; it was not a product approval round. The current live consumer uses the generator and
JavaScript embed. The showcase and standalone proof HTML remain in the deterministic build only as
legacy compatibility outputs pending coordinated retirement.

| Exact artifact | Role | Bytes | Full render, desktop / mobile | Direct observation | Result |
| --- | --- | ---: | --- | --- | --- |
| `demo/safeseed-demo.html` | Legacy compatibility output; not linked from the current article | 265,940 | `1440x2813` / `390x6771` | Byte-fresh and smoke-checked until coordinated retirement. SHA-256 `a6b30ca818736d64212bd1cc78661587af2289be42b61188b6c16b867db55ec4`. | Pass |
| `demo/safeseed-generator.html` | Current primary browser tool | 276,342 | `1440x2514` / `390x3956` | Column controls, preview, bounded audit language, downloads, and Generate/Verify modes retain hierarchy without clipping or collisions. SHA-256 `2a4b48fd3b6432b6ca5e315bdbc43b1e5f46040d51f60e5bb11c67aa8968e786`. | Pass |
| `demo/safeseed-proof.html` | Legacy compatibility output; not deployed | 258,475 | `1440x2010` / `390x5520` | Byte-fresh and smoke-checked until coordinated retirement. SHA-256 `6c43f5848df57b2e2479973d3305c2a4e410b645dc8a1a92efa5ac55655cb170`. | Pass |
| `demo/safeseed-proof.js` | Current embedded proof surface | 263,579 | `1440x2154` / `390x5860` | The custom element remains inside a constrained product-context host at both widths; shadow-DOM content, controls, tables, and result panels do not escape the frame. SHA-256 `12e00ea22f6928f81c3462fa421451e49b7bb4611ab5556992c658c17362a823`. | Pass |

The first inspection failed on two semantic visuals: the audit implied that out-of-range meant
real PII, and the receipt implied that a matching hash proved file history. Those claims were
narrowed in source, all four compatibility outputs were rebuilt, and the exact rebuilt files above
were re-rendered and re-inspected. No visual redesign was introduced. This is engineering evidence
only; no owner visual-acceptance gate applies to this security and release-hardening candidate.

## Interaction QA

- All four committed outputs passed in literal `1440x900` and `390x844` frames: eight
  browser/viewport runs. In every frame, document `scrollWidth` equaled `clientWidth`.
- The legacy showcase and standalone proof HTML were exercised only to catch compatibility
  regressions while they remain generated outputs; this does not make them current products.
- No app runtime console errors occurred. Required same-origin font assets loaded on the
  Advokat-Frida-skinned surfaces, and the exercised flows made no backend call or data upload.
- Demo, standalone proof, and embed each changed seed, failed an in-range edit with
  `content-hash-mismatch`, failed an out-of-range edit with `out-of-range-value`, returned to pass
  for the recorded bytes, and reported all three seeded outside-range scan findings.
- Generator returned a bounded range-check verdict that explicitly preserves the in-range
  coincidence limitation, switched between Generate and Verify, and kept Verify disabled until
  both local files are supplied.

## Hosted evidence to append before release

- Final reviewed commit SHA: pending.
- Exact `main` CI run URL and conclusion: pending.
- Ubuntu Action contract run: pending.
- Windows Action contract run: pending.
- macOS Action contract run: pending.
- Disposable consumer repository and workflow URL: pending.
- Consumer clean-fixture pass: pending.
- Consumer edited-value failure: pending.
- Consumer added-column failure: pending.
- Consumer retired-input bypass failure: pending.

## Remaining gates

Before release, commit the complete candidate including `dist/`, push it with explicit approval,
require green hosted CI, complete the full-SHA consumer proof, configure the protected release
settings, and then follow `PUBLISH-CHECKLIST.md`. Tagging,
publishing a GitHub Release, approving the protected npm environment, and npm publication each
require explicit approval.
