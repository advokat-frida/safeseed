# Safe Test Data by Construction

*Keeping production data out of test environments — and an honest account of exactly what that proves.*

## The problem nobody wants on the incident report

The breaches teams plan for involve production. The ones that actually happen often involve a *copy* of production sitting somewhere nobody hardened: a staging database, a CI job's fixtures, a developer's laptop, a screenshot in a bug ticket. Real personal data ends up in test environments because it is the path of least resistance — "just point it at a prod snapshot, it's faster." Non-production is where the controls are thinnest and the copies are most numerous, which makes it a quietly excellent place to lose customer data.

The fix everyone agrees on: don't put real data there. Use synthetic data instead. The disagreement is about what "synthetic" should mean — and that distinction matters more than it looks.

## Two ways to make test data "safe"

**The empirical way.** Train a model on your real production data so it learns the statistical shape, then sample new records from it. This is what most of the market sells. The output is realistic, which is the selling point. But because the model has *seen* real records, it can memorize and re-emit them — so privacy becomes something you defend *after the fact*: run membership-inference attacks, add differential-privacy noise, produce a privacy report, argue the risk is low. You can never quite prove a negative; you can only show the attacks you tried didn't succeed. And you redo that argument for every new dataset, forever.

**The by-construction way.** Never let real data into the process at all. Generate each field from values that a published standard has *reserved as permanently not real*. If the source data never touches the generator, there is nothing to memorize and nothing to leak — not because you defended it, but because the leak surface doesn't exist.

That difference is the whole point. One approach makes a probabilistic argument about a model. The other makes a structural statement about an input that was never there.

## The auditability asymmetry

This is the real advantage, and most people miss it.

A by-construction generator is a few hundred lines of logic that say "draw emails from this reserved domain, phone numbers from this reserved block." You audit that logic *once*. After that, every dataset it produces inherits the guarantee, because the guarantee is a property of the code, not of any particular output.

A model-based synthesizer reverses that: the code is generic, but each dataset it emits carries fresh risk that has to be assessed again. You are never done.

Audit once and trust every output, versus re-prove privacy on every run. For the narrow job of "no real personal data in this test environment," the first is simply the stronger position.

## What "never real" actually means — and where it gets honest

"Reserved by standard" is not hand-waving. Real, citable standards define values that can never belong to a real person or system:

- **Email and domains** — RFC 2606 reserves `example.com`, `example.net`, `example.org`, and the `.invalid` / `.example` suffixes. An address there can never route to a real mailbox.
- **IP addresses** — RFC 5737 reserves three IPv4 ranges for documentation; RFC 3849 reserves `2001:db8::/32` for IPv6. Neither can appear on the public Internet.
- **Phone numbers** — the North American numbering plan reserves `555-0100` through `555-0199` as fictitious, non-working numbers.
- **Social Security numbers** — certain ranges were never issued and are invalid by design (area numbers `000`, `666`, and `900–999`, among others).

But honesty *is* the credibility here, so the claim has tiers, and the serious version says so plainly:

- **Provably non-real by construction** — the reserved domains, IPs, phone block, and invalid SSN ranges above. These cannot be real.
- **Designated test-only** — the standard payment-card test numbers (e.g. `4242…`). These *pass* the checksum, so they are valid-looking; they are non-real by network designation and sandbox routing, *not* by mathematical impossibility. Say "designated test card," not "cannot be a real card."
- **Structurally fake** — names, street addresses, free text. No standards body reserves "fake names." The honest move is to make these *self-evidently* fake (`TEST_Lastname_000142`, `123 Example Way`) rather than plausible-but-random people — because a randomly generated "John Smith at 42 Main St" can coincidentally match a living person, and the law does not care that you generated it.

Stating which tier each field sits in is not a weakness to bury. It is the thing that separates a practitioner from a datasheet.

## Where the proof stops

The fastest way to lose a security reviewer is to claim more than you can defend. So here is the boundary, drawn on purpose:

- **It attests the generator, not your environment.** "Generated from reserved ranges, no real input" is true at the moment of generation. It says nothing about the file that later lands in your CI — which someone could edit, join against a prod snapshot, or quietly replace. The assurance has to be re-checked against the *actual artifact* (hash the file, verify it in the pipeline), and it rests on the *auditable, open code* — not on a certificate. A signature proves the tool ran; it does not prove the tool is right.
- **"Not derived from production data" is not "not personal data."** The defensible claim is the former. Never the latter.
- **It is a security-of-processing and data-minimization control** for non-production environments (in GDPR terms, Articles 25 and 32; in audit terms, SOC 2 and ISO 27001). It is *not* a scope-out from privacy law, not a DSAR answer, not a lawful-basis story.
- **It is deliberately low-fidelity.** Every phone in one small block, every IP in three ranges. That is correct for "prove there's no real PII in functional and CI tests," and wrong as your general fixture source, your ML training data, or your load-testing input. Reach for it for *assurance*, not realism — and say so loudly, so nobody blames it for an escaped bug.

## "Why not just use Faker and trust me?"

Because "trust me" is not an artifact, and the person who signs the "no production data in non-prod" attestation cannot hand an auditor "trust me." Off-the-shelf fake-data libraries already emit reserved-range values; what is missing is the *discipline* around them — every personal-data field tied to a cited standard, an enforcement check that fails the build when a value drifts out of range, a scan that flags real-looking data already sitting in your test environment, and an honest written statement of exactly what is and isn't guaranteed. That discipline is the contribution. The generator was never the hard part.

(One aside, because it comes up: membership-inference and other leakage detectors exist to catch a model that memorized its training data. A by-construction generator has no model and no training data, so that test is inapplicable here — it would pass vacuously. Knowing which test belongs to which design is part of the point.)

## The honest one-line version

This does not make your test data realistic, and it does not make it legally invisible. It makes *"no production data crossed this boundary"* a property you can audit once and enforce every time, for the one job that actually causes incidents — and it tells you, in writing, exactly where that guarantee ends.
