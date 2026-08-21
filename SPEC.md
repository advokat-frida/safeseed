# SPEC — SafeSeed

*Frida's Toolkit, v1 flagship. Status: built; practical `0.4.0` field-and-preset candidate remains local. Companion essay: [docs/safe-test-data-by-construction.md](docs/safe-test-data-by-construction.md).*

> Name: **SafeSeed** (locked). Deliberately **not** "Cleanroom" — "data clean room" is an established privacy term for privacy-preserving data collaboration, a different thing; reusing it would read as not knowing the field.

## In plain language (for non-technical stakeholders)

*Written so it can be shared, or adapted, for buy-in conversations (e.g. Legal, Operations, leadership).*

**The problem.** Companies guard their production systems carefully, but copies of real customer data quietly pile up in places that get far less protection: test databases, automated build systems, developers' laptops, screenshots in bug reports. A lot of real-world data exposure happens in those overlooked copies, not at the front door. The standard advice is "don't test with real customer data, use fake stand-in data." The catch: most "fake" data is produced by software that *learned from real data*, so it can accidentally reproduce real people, and you can never fully prove it didn't.

**What SafeSeed does.** Three simple things.
1. Makes stand-in test data without reading a production dataset. It builds values from a small catalog of protocol-reserved, authority-reserved, test-designated, and deliberately obvious fakes, and states the limits of each tier.
2. Binds the generated file to a run record and checks that every declared value is still inside its catalog constraint.
3. Scans data you *already* have in a test system and flags values outside the configured ranges for review. It is a detector, not proof that a clean file contains no real personal data.

**Why it matters to us.** It reduces a common route by which production data reaches weakly controlled test systems, and it produces a written, checkable record of the generator, catalog version, and artifact instead of "we're pretty sure it's fine." It is free, runs entirely on your own machine (nothing is uploaded anywhere), and can support a broader privacy-by-design and data-minimization control program (GDPR Articles 25 and 32, SOC 2, ISO 27001).

**What it does NOT claim (so we never oversell).** It does not make data realistic enough for performance testing or AI training — that is a different job. Its structural claim is that SafeSeed's generator accepts no production dataset; its field claims are only the tier-specific statements in the versioned catalog. It does not declare the output "legally not personal information" or rule out every accidental coincidence.

## Goal

One tool, polished to a shine, that helps teams keep production PII out of test/CI environments and gives security and legal an honest, checkable assurance. Post-battle-test, this is **not** "a synthetic data generator" (a free library already does that). It is the **safe-data attestation + enforcement + detection layer** around test data. Its purpose is credibility: a single artifact that demonstrates Ben understands both the privacy standards (the law) and how to build and enforce a control (the tech).

The credibility lead is the essay; the tool is proof he can also ship.

## Shape

- **Pure TypeScript core** (zero DOM) + three thin shells:
  - **CLI / npm package** — what CI actually calls.
  - **`verify` GitHub Action** — the enforcement gate. A pure Node 24 wrapper executes the
    committed `dist/` bytes from the selected tag or SHA; it does not shell-evaluate inputs or
    download a second CLI version from npm.
  - **Browser generator and verifier** — the front door: catalog fields only, no pasted or imported
    customer values, and strict exact-pair verification matching the public Action.
- **Generator-agnostic by design.** The assurance layer (catalog + `verify` + `scan` + run record) operates on *any* data file, however it was produced — so a team can keep the generator they already use (Faker, Mockaroo, hand-written fixtures) and wrap it. SafeSeed ships its own small catalog-bounded generator so it works standalone; Faker is an optional adapter for *realistic non-PII* fields only, never for PII-shaped ones (those always come from the cited catalog constraints).
- MIT, local/client-side, **no backend, no accounts, no telemetry**, copyleft-free dependencies.

## Repository structure

**SafeSeed gets its own repository**, under the Frida's Toolkit brand / GitHub org, cross-linked — not a sub-folder of the toolkit microsite. Best-practice reasoning:

- **Different artifact type.** SafeSeed publishes an npm package, a CLI, and a public GitHub Action from one immutable versioned release. The browser tiles (NIST PRAM wizard, etc.) are a single web microsite that never touches npm. Mixing those release lifecycles in one tree is friction.
- **Credibility and focus.** A dedicated, polished repo with a tight README and the companion essay is a stronger thing to hand Legal, Operations, a hiring manager, or a CISO than "folder 3 of a grab-bag." It also makes the bounded promise — *audit the versioned catalog, then verify each artifact against it* — easy to inspect; a mixed repo dilutes that.
- **Brand cohesion without a monorepo.** Both repos live under one GitHub org and cross-link. Frida's Toolkit is the umbrella: the brand, the browser-tile microsite, and a landing page that links out to SafeSeed.

A monorepo would only win if everything were the same artifact type with heavy shared code (true for the *tiles*, not for SafeSeed). The shared UI (the fox / parchment design system) can be copied for v1 and extracted into a shared package later only if the duplication actually starts to hurt.

## Capabilities (v1)

1. **Assurance catalog** — versioned data mapping each PII-shaped field type to a protocol reservation, authority policy, published test designation, deliberately fake convention, or exact derivation from one of those constrained inputs, with its citation and assurance boundary. This is the reusable IP.
2. **Generate** — schema-driven, deterministic (seeded so output is a committable fixture), with a **format-valid safe mode**, self-evidently-fake tokens (`TEST_Lastname_000142`, `TEST_COOKIE_ID_000142`), fixed derived-hash allowlists, and four small sales/marketing schema presets that remain ordinary editable schemas.
3. **Run record (unsigned integrity receipt)** — hashes the actual emitted file + schema + catalog version + per-field tiers and derivations. Honest language: it is a self-declared comparison record whose drift evidence depends on protecting or reviewing the record separately, not authenticated provenance or "cryptographic proof of no PII." (Optional org-controlled-key signing is a later upgrade, not v1.)
4. **`verify`** — re-hashes the artifact, checks every field against its declared range, validates the run record, exits non-zero on any drift. Wireable as a required CI/merge gate.
5. **`scan` (reverse mode)** — point it at an *existing* CSV / seed file; it flags values that are **not** in reserved ranges as candidate real PII. (Security said this is what they'd deploy week one — it addresses the prod dump already sitting in staging, not just virgin data.)
6. **In-artifact threat model** — a plain "what this attests / what it does NOT" statement shipped with the tool, the CLI output, and the demo.
7. **The assurance-tier taxonomy** baked into every output: each field labeled protocol-reserved / authority-reserved / designated-test-only / structurally-fake.

## Acceptance (observable behavior)

- A generated dataset passes a real, non-trivial app's input validators and **one CI suite end-to-end** (the "prove it before showing anyone" gate).
- `verify` fails the build when current bytes differ from the run record; passes when they match.
- `scan` flags planted real-looking PII in a sample seed; passes a clean one.
- Malformed CSV syntax fails closed before a clean range result can be reported.
- Every PII-shaped field in output traces to a cited catalog constraint; structurally-fake fields are self-evidently fake, and transformed fields accept only a published allowlist rather than arbitrary shape-valid values.
- Caller-controlled CSV headers are single-line, unique, and cannot begin after whitespace with
  `=`, `+`, `-`, or `@`; generation and record creation reject spreadsheet-triggering names before
  writing an artifact.
- CSV syntax errors fail closed across verify, scan, and record creation. Browser diagnostics do not
  echo submitted candidate values, raw fingerprints, or full submitted headers.
- Browser demo makes **no data-service or external-origin requests**. Its CSP ships with
  `connect-src 'none'`; a hosted copy may load only same-origin static fonts under `font-src 'self'`.
- Browser verification passes the untouched generated pair and fails any added, removed, reordered,
  or edited column. Column-scoped verification exists only behind an explicit CLI/library option.
- The "what this does NOT prove" statement is present in CLI output, the demo, and the README.

## Tests (named up front — TDD pre-commitment)

**catalog**
- `catalog.everyFieldHasCitationAndTier`
- `catalog.reservedRangesMatchStandards` (RFC 2606 domains, RFC 5737 / 3849 IPs, NANPA and Ofcom phone blocks, invalid SSN ranges, exact derived-hash allowlists)

**generate**
- `generate.deterministicForSeed`
- `generate.everyPiiValueInDeclaredReservedRange`
- `generate.formatValidModePassesCommonValidators` (email regex; Luhn for designated test cards; syntactic SSN)
- `generate.structurallyFakeFieldsAreSelfEvidentlyFake`

**verify**
- `verify.passesOnUntouchedOutput`
- `verify.failsOnContentHashMismatch`
- `verify.failsOnOutOfRangeValue`
- `verify.exitsNonZeroOnDrift`

**scan**
- `scan.flagsNonReservedValuesAsCandidatePii`
- `scan.passesOnAllReservedData`
- `scan.reportsPerFieldFindings`

**record**
- `record.bindsToOutputFileHash`
- `record.statesTierPerField`
- `record.usesHonestLanguageNoOverclaim` (no absolute impossibility or lifetime-policy claim on any tier)

## Out of scope (deliberate)

- Statistical fidelity / realistic distributions; ML-training data; load/perf testing.
- Model-based synthesis of any kind.
- **The IBM-style membership-inference / leakage detector as a feature** — killed by the panel (unanimous). Keep only as a one-line citation in the essay, and optionally a one-time *published* comparison run against a competitor's model-synthesized output (marketing asset, never a control).
- Real PKI/CA-backed signing in v1 (content-hash tamper-evidence + optional self-published key only; use the word "signed" only if a real key story exists).
- Full C2PA conformance.
- Referential integrity / relational foreign-key output. The current opaque IDs are per-column test tokens, not a relationship engine.
- Arbitrary hashed identifiers, UUIDs, cookie IDs, click IDs, or URLs accepted merely because their shape is plausible. Those values can represent real customers; only exact SafeSeed catalog patterns pass.
- Arbitrary pasted values or imported production files in the browser generator. Business columns
  added elsewhere remain outside the browser's strict pair and require the explicit CLI/library contract.
- Backend, user accounts, analytics.

## Build sequence (after go)

0. Create **SafeSeed as its own repo** (see Repository structure), MIT, under the Frida's Toolkit brand. Separately, rename the existing scaffold `advokat-frida-tools` → `frida-toolkit` to become the umbrella microsite for browser tiles, and park it (the Risk Matrix draft stays in history at commit `c7601ad`); it is not part of SafeSeed v1.
1. TS core — catalog, generate, verify, scan — built TDD from the named tests above.
2. CLI / npm wrapper.
3. `verify` GitHub Action.
4. Browser demo shell (reuse the existing fox/parchment design system).
5. In-artifact threat model + README; link the companion essay.
6. Acceptance gate: run output through one real CI suite end-to-end before showing anyone.

## Licensing / dependencies

MIT end to end. Vet every dependency's license; never bundle or link GPL/LGPL code (specifically not Privado's scanner). PII-shaped fields always come from the hand-rolled, cited reserved-range logic; Faker (MIT) is an optional adapter for *realistic non-PII* fields a team explicitly opts into, and the structurally-fake tier defaults to self-evidently-fake tokens, not realistic names.

## Positioning guardrails (from the panel)

- Sell the **boundary argument** and the **auditability asymmetry**: review a small versioned catalog, then verify every artifact against the current contract. Do not imply a one-time review makes future outputs trustworthy forever.
- Position legally as an Article 25 / Article 32 (privacy-by-design, security-of-processing) and data-minimization control for **non-production** environments. Never "the output is not personal data" — only "not derived from production data."
- Compare against the real incumbent (Faker + a CI policy gate + a PII scanner), not against ML synthesizers nobody used for this job.
- Draw the scope limits loudly: assurance, not realism. Say "do not use as your general fidelity/edge-case fixture source."
