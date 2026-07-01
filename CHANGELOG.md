# Changelog

## 0.2.1 — 2026-07-01

### The SSN range was wrong: it collided with real ITINs. Fixed, breaking, on purpose.

**What was wrong.** SafeSeed 0.2.0 generated SSNs from the `900-999` area range and treated that whole range as reserved, on the theory that the SSA never assigns it. The SSA part is true — but `9XX-XX-XXXX` is the IRS **ITIN** space: Individual Taxpayer Identification Numbers, real identifiers issued to real people, with group ranges (`50-65`, `70-88`, `90-92`, `94-99`) the IRS has expanded over time. Roughly a third of the SSNs SafeSeed 0.2.0 generated matched live ITIN patterns. Two claims failed at once: the README's "never assigned, so no real holder has one" was false for those values, and `scan` would pass a column of genuine ITINs as clean.

**What changed.**

- **Generation** now emits only values containing a component that is never issued under *both* the SSA scheme and the IRS ITIN scheme: a plausible-looking area in `001-899` (never `666`, never the `9XX` ITIN space) with group forced to `00` or serial forced to `0000`. Values stay format-shaped (`NNN-NN-NNNN`), deterministic per seed, and entirely outside ITIN territory — robust even if the IRS expands its ITIN group ranges again.
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
