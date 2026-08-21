# Safe Test Data by Construction

*Keeping production data out of test environments — and an honest account of exactly what that proves.*

## The problem nobody wants on the incident report

The breaches teams plan for involve production. The ones that actually happen often involve a *copy* of production sitting somewhere nobody hardened: a staging database, a CI job's fixtures, a developer's laptop, a screenshot in a bug ticket. Real personal data ends up in test environments because it is the path of least resistance — "just point it at a prod snapshot, it's faster." Non-production is where the controls are thinnest and the copies are most numerous, which makes it a quietly excellent place to lose customer data.

The fix everyone agrees on: don't put real data there. Use synthetic data instead. The disagreement is about what "synthetic" should mean — and that distinction matters more than it looks.

## Two ways to make test data "safe"

**The empirical way.** Train a model on your real production data so it learns the statistical shape, then sample new records from it. This is what most of the market sells. The output is realistic, which is the selling point. But because the model has *seen* real records, it can memorize and re-emit them — so privacy becomes something you defend *after the fact*: run membership-inference attacks, add differential-privacy noise, produce a privacy report, argue the risk is low. You can never quite prove a negative; you can only show the attacks you tried didn't succeed. And you redo that argument for every new dataset, forever.

**The by-construction way.** Do not use production records as source material for generated fields. Generate each declared field from a small, reviewable catalog: protocol-reserved values, authority-reserved ranges, published test values, and deliberately obvious fakes. With no source dataset and no trained model in that field path, the generator cannot memorize or reproduce a source record. User-added columns remain outside the attestation. That is a structural claim about the input path, not a blanket promise that every generated string is incapable of coinciding with a real person.

That difference is the whole point. One approach makes a probabilistic argument about a model. The other makes a structural statement about an input that was never there.

## The auditability asymmetry

This is the real advantage, and most people miss it.

A by-construction generator is a few hundred lines of logic that say "draw emails from this reserved domain, phone numbers from this reserved block." The privacy argument is concentrated in that code and its source catalog instead of being reconstructed for every source dataset. That makes review tractable, but not permanent: SafeSeed's catalog is versioned and must be re-reviewed when standards, issuing-authority policy, or generator logic changes.

A model-based synthesizer reverses that: the code is generic, but each source dataset and trained model can carry fresh memorization risk that has to be assessed again.

SafeSeed still verifies every exported artifact. Its run record binds the file, declared fields, catalog version, and field-level hashes; strict verification fails when the file drifts. The useful asymmetry is therefore **review a small versioned catalog, then verify every artifact**, rather than treat a one-time audit as a lifetime guarantee.

## What each assurance tier actually means

"Reserved by standard" is not hand-waving, but neither is every reservation the same. Published protocols and authority policies define bounded spaces for documentation, testing, fictitious use, or invalid identifiers. The exact consequence and maintenance burden differs by field:

- **Email and domains** — RFC 2606 reserves `example.com`, `example.net`, `example.org`, and the `.invalid` / `.example` names for documentation and testing. They are not customer-controlled production domains; `.invalid` is specifically intended to be invalid.
- **IP addresses** — RFC 5737 reserves three IPv4 ranges for documentation; RFC 3849 reserves `2001:db8::/32` for IPv6. They are not globally assigned addresses for production hosts.
- **Phone numbers** — the North American numbering plan reserves `555-0100` through `555-0199` for fictitious, non-working use. This is an administrative reservation, so SafeSeed treats the cited policy as a release-time dependency rather than an eternal fact.
- **UK phone numbers** — Ofcom publishes `07700 900000` through `07700 900999` for TV and radio drama and says the block will not be allocated to providers in the foreseeable future. SafeSeed treats that as another current authority-policy dependency, not a permanent mathematical fact.
- **Social Security numbers** — SafeSeed uses components the SSA identifies as invalid for SSNs: area `000` or `666`, group `00`, or serial `0000`. It deliberately does not use the `900–999` area range because that overlaps the IRS ITIN space, which contains issued identifiers. This is an authority-policy claim and must be checked against the current cited sources when the catalog changes.
- **Marketing URLs and opaque IDs** — no authority reserves UTM strings, cookie IDs, click IDs, lead IDs, or account IDs. SafeSeed therefore uses a reserved example host plus exact `TEST_` parameters, or cookie-safe `TEST_` identifiers named for the column. An arbitrary URL or opaque string does not pass.
- **Hashed marketing identifiers** — SHA-256 supplies a wire shape, not a fake-data namespace. SafeSeed publishes 100 source-to-digest pairs for each hash type; the known email or phone inputs already sit inside a catalog constraint. That keeps the default 100-row fixture unique without opening acceptance to arbitrary hashes. Larger jobs cycle the bounded list. The run record names the derivation. The digest itself is not reserved, visibly fake, or anonymous, and an arbitrary 64-hex value fails.

But honesty *is* the credibility here, so the claim has tiers, and the serious version says so plainly:

- **Protocol-reserved** — `.invalid`, the example names, and documentation IP ranges are reserved by published internet standards. The exact consequence differs by field: `.invalid` is non-resolving by design, while the example names and address blocks are reserved for documentation rather than customer production use.
- **Authority-reserved** — the `555-01xx` phone block and invalid SSN components (area `000`/`666`, group `00`, serial `0000`). This tier rests on the cited issuing authority's current policy, so it is revalidated when SafeSeed's catalog or release claim changes.
- **Designated test-only** — published payment-card test numbers (e.g. `4242…` in processor testing docs). These *pass* the checksum, so they are valid-looking and intended for test mode. The processor/sandbox designation is the assurance source, not mathematical impossibility. Say "designated test card," not "cannot be a real card."
- **Structurally fake** — names, street addresses, free text. No standards body reserves "fake names." The honest move is to make these *self-evidently* fake (`TEST_Lastname_000142`, `123 Example Way`) rather than plausible-but-random people — because a randomly generated "John Smith at 42 Main St" can coincidentally match a living person, and the law does not care that you generated it.

Stating which tier each field sits in is not a weakness to bury. It is the thing that separates a practitioner from a datasheet.

Derived hashes do not create a fifth tier. The tier records the known input's assurance basis, and
the separate derivation records SHA-256. That distinction prevents "64 hex characters" from
quietly becoming a pass condition for a hash that may have come from real customer data.

## Where the proof stops

The fastest way to lose a security reviewer is to claim more than you can defend. So here is the boundary, drawn on purpose:

- **The record declares provenance; it does not authenticate it.** The CLI and browser generator can make the structural claim "generated without a production dataset, under catalog version X" because their generation path accepts no source records. The exported record API also accepts a structurally supplied JavaScript dataset: it checks that declared CSV fields agree with that object and the current catalog, but cannot independently recover the object's history. The unsigned hash detects file drift only when the comparison record is separately protected or reviewed. The assurance rests on the auditable generation path and that external control, not on a certificate.
- **"Not derived from production data" is not "not personal data."** The defensible claim is the former. Never the latter.
- **It is a security-of-processing and data-minimization control** for non-production environments (in GDPR terms, Articles 25 and 32; in audit terms, SOC 2 and ISO 27001). It is *not* a scope-out from privacy law, not a DSAR answer, not a lawful-basis story.
- **It is deliberately low-fidelity.** Every phone sits in one small block, every IP in three documentation ranges. That is useful for enforcing a no-production-input fixture path, and wrong as your general fixture source, your ML training data, or your load-testing input. Reach for it for *assurance*, not realism — and say so loudly, so nobody blames it for an escaped bug.

## "Why not just use Faker and trust me?"

Because "trust me" is not an artifact, and the person who signs the "no production data in non-prod" attestation cannot hand an auditor "trust me." Off-the-shelf fake-data libraries already emit reserved-range values; what is missing is the *discipline* around them — every personal-data field tied to a cited standard, an enforcement check that fails the build when a value drifts out of range, a scan that flags real-looking data already sitting in your test environment, and an honest written statement of exactly what is and isn't guaranteed. That discipline is the contribution. The generator was never the hard part.

(One aside, because it comes up: membership-inference and other leakage detectors exist to catch a model that memorized its training data. A by-construction generator has no model and no training data, so that test is inapplicable here — it would pass vacuously. Knowing which test belongs to which design is part of the point.)

## The honest one-line version

This does not make your test data realistic, and it does not make it legally invisible. It gives you a versioned, inspectable basis for saying *"this generator did not ingest production data"*, plus an artifact check that fails when the generated file drifts. Each field keeps its own assurance tier, and the catalog still has to be maintained.
