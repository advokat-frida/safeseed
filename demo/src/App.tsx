import { useSyncExternalStore } from "react";
import ProofPanel from "./components/ProofPanel";
import { getNetworkCount, subscribeNetworkCount } from "./netGuard";
import foxLogo from "./assets/fox-logo.png";

function useNetworkCount() {
  return useSyncExternalStore(subscribeNetworkCount, getNetworkCount);
}

export default function App() {
  const netCount = useNetworkCount();

  return (
    <div className="site">
      {/* MASTHEAD */}
      <header className="masthead">
        <span className="masthead-mark">SAFESEED</span>
        <span className="masthead-dateline">No. 01 · client-side · MIT · zero network</span>
      </header>

      <main className="site-main">
        {/* HERO */}
        <section className="hero">
          <div className="hero-lead">
            <h1 className="hero-headline">
              Test data with <span className="hl">no real person</span> inside it.
            </h1>
            <p className="hero-sub">
              Not scrubbed after the fact — drawn by construction from ranges the standards bodies reserve as
              permanently not-real. If real data never enters the generator, there is no real record for it to
              memorize or re-emit. Confirmably synthetic by construction, not by promise.
            </p>
            <div className="verb-chips">
              <span className="verb-chip on">Generate</span>
              <span className="verb-chip">Verify</span>
              <span className="verb-chip">Scan</span>
            </div>
          </div>

          <aside className="airgap">
            <span className="airgap-medallion">
              <img className="fox-neon" src={foxLogo} alt="Advokat Frida" width={72} height={72} />
            </span>
            <code className="airgap-csp">connect-src 'none'</code>
            <div className="airgap-counter">
              <span className="airgap-n">{netCount}</span>
              <span className="airgap-l">fetch / XHR / beacon calls this session</span>
            </div>
            <p className="airgap-cap">
              The shipped build enforces it with CSP <code>connect-src 'none'</code>; this counter catches any
              attempt live. Confirm in your network tab.
            </p>
            <p className="airgap-teaser">
              It attests the generator, not your environment — and "not derived from production data" is not "not
              personal data." <a href="#boundary">Read the full note ↓</a>
            </p>
          </aside>
        </section>

        {/* HONESTY TIERS */}
        <section className="tiers">
          <h2 className="section-h">Three honesty tiers</h2>
          <p className="section-lead">
            Color encodes the strength of the claim, never decoration. Every value on this page carries its tier.
          </p>
          <div className="tier-cards">
            <div className="tier-card tier-provable">
              <span className="tier-dot" />
              <h3>Provably non-real</h3>
              <p>
                Reserved by a published standard — it cannot belong to a real person or system. RFC 2606 domains, RFC
                5737 / 3849 IPs, NANPA 555-01xx phones, never-assigned SSN ranges.
              </p>
            </div>
            <div className="tier-card tier-designated">
              <span className="tier-dot" />
              <h3>Designated test-only</h3>
              <p>
                A valid-looking value designated for testing — e.g. a processor test card that passes Luhn but authorizes
                nowhere. Non-real by designation, <em>not</em> by impossibility.
              </p>
            </div>
            <div className="tier-card tier-fake">
              <span className="tier-dot" />
              <h3>Structurally fake</h3>
              <p>
                No standard reserves names or addresses, so these are made self-evidently fake (TEST_ tokens, Example
                streets) rather than plausible-but-random.
              </p>
            </div>
          </div>
        </section>

        {/* THREE OPERATIONS */}
        <section className="ops">
          <h2 className="section-h">One small library, three jobs</h2>
          <div className="op-cards">
            <div className="card op">
              <h3>Generate</h3>
              <p>Produce test data from cited reserved ranges, deterministically from a seed.</p>
              <p className="op-note">
                Model-based synthesizers learn from real data and can memorize and regurgitate real records. By-construction
                generation has no training step and no real input, so there is nothing to memorize.
              </p>
            </div>
            <div className="card op">
              <h3>Verify</h3>
              <p>
                Re-check that a file is byte-identical to what was generated and every value is still in range. Wire it
                into CI and it fails the build on drift.
              </p>
            </div>
            <div className="card op">
              <h3>Scan</h3>
              <p>
                Point it at an existing seed file and it flags values outside reserved ranges as candidate real PII — the
                copy of production already sitting in staging.
              </p>
            </div>
          </div>
        </section>

        {/* PROOF PANEL (interactive centerpiece) */}
        <ProofPanel />

        {/* CI GATE */}
        <section className="cigate">
          <h2 className="section-h">Wire it into CI</h2>
          <p className="section-lead">The verify step fails closed — exit 1 on a tampered or out-of-range file blocks the merge.</p>
          <pre className="code">
{`# generate a committable fixture, offline and deterministic
npx safeseed generate \\
  --fields email:email,phone:phone,ssn:ssn,card:creditCard \\
  --rows 1000 --seed 1337 \\
  --out fixtures/seed.csv --record fixtures/seed.record.json

# fail the build if it ever drifts out of range or is tampered with
npx safeseed verify --in fixtures/seed.csv --record fixtures/seed.record.json`}
          </pre>
          <pre className="code">
{`# .github/workflows/ci.yml  — as a required check
- uses: tanjaminben/safeseed@v0
  with:
    data: fixtures/seed.csv
    record: fixtures/seed.record.json`}
          </pre>
        </section>

        {/* BOUNDARY */}
        <section className="boundary" id="boundary">
          <h2 className="boundary-h">What this proves — and what it does not</h2>
          <p>
            SafeSeed attests the <strong>generator</strong>, not your <strong>environment</strong>. It proves that the
            data it produced was drawn entirely from standards-reserved, non-real ranges and has not been altered since.
            It does not prove your pipeline is clean, that no real data sits beside this file, or that your test
            environment is secure.
          </p>
          <p>
            "Not derived from production data" is not the same as "not personal data." Treat output as a
            data-minimization control for non-production use — evidence toward GDPR Art. 25 &amp; 32, SOC 2, and ISO
            27001 — not as a determination that privacy law does not apply.
          </p>
          <p>
            This data is deliberately low-fidelity. It is built to be safe and self-evidently fake, not to be
            statistically representative. If you need distributional realism, this is the wrong tool, on purpose.
          </p>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-fox">
          <img className="fox-neon" src="/fox-logo.png" alt="" width={32} height={32} />
        </div>
        <p className="footer-note">
          <strong>No telemetry, no analytics, no network.</strong> Everything here runs in your browser — verify it in
          the network tab. Open source, MIT.
        </p>
        <p className="footer-links">
          <a href="https://github.com/tanjaminben/safeseed">github.com/tanjaminben/safeseed</a>
          <span>·</span>
          <span>Part of Advokat Frida</span>
        </p>
      </footer>
    </div>
  );
}
