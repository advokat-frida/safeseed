# SPEC — SafeSeed

*Frida's Toolkit, v1 flagship. Status: drafted, awaiting go-for-code. Companion essay: [docs/safe-test-data-by-construction.md](docs/safe-test-data-by-construction.md).*

> Name: **SafeSeed** (locked). Deliberately **not** "Cleanroom" — "data clean room" is an established privacy term for privacy-preserving data collaboration, a different thing; reusing it would read as not knowing the field.

## In plain language (for non-technical stakeholders)

*Written so it can be shared, or adapted, for buy-in conversations (e.g. Legal, Operations, leadership).*

**The problem.** Companies guard their production systems carefully, but copies of real customer data quietly pile up in places that get far less protection: test databases, automated build systems, developers' laptops, screenshots in bug reports. A lot of real-world data exposure happens in those overlooked copies, not at the front door. The standard advice is "don't test with real customer data, use fake stand-in data." The catch: most "fake" data is produced by software that *learned from real data*, so it can accidentally reproduce real people, and you can never fully prove it didn't.

**What SafeSeed does.** Three simple things.
1. Makes stand-in test data that is fake *by design* — it never looks at any real customer data, and it builds values out of phone/address/email ranges that official standards have set aside as "can never belong to a real person." There is no real data to leak, by construction.
2. Checks a data file and gives an honest grade on whether everything in it is the safe kind.
3. Scans data you *already* have in a test system and flags anything that looks like real customer data that slipped in.

**Why it matters to us.** It cuts the risk of a privacy incident in exactly the overlooked places those incidents come from, and it produces a written, checkable record we can show an auditor or regulator instead of "we're pretty sure it's fine." It is free, runs entirely on your own machine (nothing is uploaded anywhere), and supports privacy-by-design and data-minimization expectations (GDPR Articles 25 and 32, SOC 2, ISO 27001).

**What it does NOT claim (so we never oversell).** It does not make data realistic enough for performance testing or AI training — that is a different job. And it proves the data was *not built from production data*; it does not declare the data "legally not personal information." We are precise about that on purpose, because overclaiming is how you lose a careful reviewer's trust.

## Goal

One tool, polished to a shine, that helps teams keep production PII out of test/CI environments and gives security and legal an honest, checkable assurance. Post-battle-test, this is **not** "a synthetic data generator" (a free library already does that). It is the **safe-data attestation + enforcement + detection layer** around test data. Its purpose is credibility: a single artifact that demonstrates Ben understands both the privacy standards (the law) and how to build and enforce a control (the tech).

The credibility lead is the essay; the tool is proof he can also ship.

## Shape

- **Pure TypeScript core** (zero DOM) + three thin shells:
  - **CLI / npm package** — what CI actually calls.
  - **`verify` GitHub Action** — the enforcement gate.
  - **Browser demo** — the front door, reusing the parchment/fox design system already built.
- **Generator-agnostic by design.** The assurance layer (catalog + `verify` + `scan` + run record) operates on *any* data file, however it was produced — so a team can keep the generator they already use (Faker, Mockaroo, hand-written fixtures) and wrap it. SafeSeed ships its own small reserved-range generator so it works standalone; Faker is an optional adapter for *realistic non-PII* fields only, never for PII-shaped ones (those always come from the cited reserved ranges).
- MIT, local/client-side, **no backend, no accounts, no telemetry**, copyleft-free dependencies.

## Repository structure

**SafeSeed gets its own repository**, under the Frida's Toolkit brand / GitHub org, cross-linked — not a sub-folder of the toolkit microsite. Best-practice reasoning:

- **Different artifact type.** SafeSeed publishes an npm package, a CLI, and a GitHub Action — each with its own versioning, releases, and (for the Action) a Marketplace listing. The browser tiles (NIST PRAM wizard, etc.) are a single web microsite that never touches npm. Mixing those release lifecycles in one tree is friction.
- **Credibility and focus.** A dedicated, polished repo with a tight README and the companion essay is a stronger thing to hand Legal, Operations, a hiring manager, or a CISO than "folder 3 of a grab-bag." It also makes the core promise — *audit a few hundred cited lines once, trust every output* — easy to verify; a mixed repo dilutes that.
- **Brand cohesion without a monorepo.** Both repos live under one GitHub org and cross-link. Frida's Toolkit is the umbrella: the brand, the browser-tile microsite, and a landing page that links out to SafeSeed.

A monorepo would only win if everything were the same artifact type with heavy shared code (true for the *tiles*, not for SafeSeed). The shared UI (the fox / parchment design system) can be copied for v1 and extracted into a shared package later only if the duplication actually starts to hurt.

## Capabilities (v1)

1. **Reserved-range catalog** — versioned data mapping each PII field type to a standards-reserved "never-real" range, its citation, and its honesty tier. This is the reusable IP.
2. **Generate** — schema-driven, deterministic (seeded so output is a committable fixture), with a **format-valid safe mode** (values that pass common validators while staying reserved), and **self-evidently-fake tokens** (`TEST_Lastname_000142`, `123 Example Way`) for the structurally-fake tier.
3. **Run record (tamper-evident)** — hashes the actual emitted file + schema + catalog version + per-field tiers. Honest language: a *tamper-evident run record*, not "cryptographic proof of no PII." (Optional org-controlled-key signing is a later upgrade, not v1.)
4. **`verify`** — re-hashes the artifact, checks every field against its declared range, validates the run record, exits non-zero on any drift. Wireable as a required CI/merge gate.
5. **`scan` (reverse mode)** — point it at an *existing* CSV / seed file; it flags values that are **not** in reserved ranges as candidate real PII. (Security said this is what they'd deploy week one — it addresses the prod dump already sitting in staging, not just virgin data.)
6. **In-artifact threat model** — a plain "what this attests / what it does NOT" statement shipped with the tool, the CLI output, and the demo.
7. **The provable-tier taxonomy** baked into every output: each field labeled provably-non-real / designated-test-only / structurally-fake.

## Acceptance (observable behavior)

- A generated dataset passes a real, non-trivial app's input validators and **one CI suite end-to-end** (the "prove it before showing anyone" gate).
- `verify` fails the build on a tampered file; passes on an untouched one.
- `scan` flags planted real-looking PII in a sample seed; passes a clean one.
- Every PII field in output traces to a cited reserved range; structurally-fake fields are self-evidently fake.
- Browser demo runs with **zero network calls** (verifiable in the network tab; CSP `connect-src 'none'` shipped in the artifact).
- The "what this does NOT prove" statement is present in CLI output, the demo, and the README.

## Tests (named up front — TDD pre-commitment)

**catalog**
- `catalog.everyFieldHasCitationAndTier`
- `catalog.reservedRangesMatchStandards` (RFC 2606 domains, RFC 5737 / 3849 IPs, NANPA 555-0100..0199, invalid SSN ranges)

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
- `record.usesHonestLanguageNoOverclaim` (no "proof" / "cannot be real" on the designated-test or structurally-fake tiers)

## Out of scope (deliberate)

- Statistical fidelity / realistic distributions; ML-training data; load/perf testing.
- Model-based synthesis of any kind.
- **The IBM-style membership-inference / leakage detector as a feature** — killed by the panel (unanimous). Keep only as a one-line citation in the essay, and optionally a one-time *published* comparison run against a competitor's model-synthesized output (marketing asset, never a control).
- Real PKI/CA-backed signing in v1 (content-hash tamper-evidence + optional self-published key only; use the word "signed" only if a real key story exists).
- Full C2PA conformance.
- Referential integrity / relational foreign-key output — candidate **v1.1**, noted because the privacy engineer wants it for integration tests.
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

- Sell the **boundary argument** and the **auditability asymmetry** ("audit the cited range logic once, trust every output forever"), not the crypto.
- Position legally as an Article 25 / Article 32 (privacy-by-design, security-of-processing) and data-minimization control for **non-production** environments. Never "the output is not personal data" — only "not derived from production data."
- Compare against the real incumbent (Faker + a CI policy gate + a PII scanner), not against ML synthesizers nobody used for this job.
- Draw the scope limits loudly: assurance, not realism. Say "do not use as your general fidelity/edge-case fixture source."
