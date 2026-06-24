import { useState, useSyncExternalStore } from "react";
import ProofPanel from "./components/ProofPanel";
import { getNetworkCount, subscribeNetworkCount } from "./netGuard";
import foxLogo from "./assets/fox-logo.png";

function useNetworkCount() {
  return useSyncExternalStore(subscribeNetworkCount, getNetworkCount);
}

/** Copy-to-clipboard with a graceful fallback for insecure / file:// contexts. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op rather than throw */
    }
  };
  return (
    <button type="button" className={`copy-btn ${copied ? "copied" : ""}`} onClick={onCopy}>
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="code-block">
      <CopyButton text={code} />
      <pre className="code">{code}</pre>
    </div>
  );
}

const CI_GENERATE = `# generate a committable fixture, offline and deterministic
npx safeseed generate \\
  --fields email:email,phone:phone,ssn:ssn,card:creditCard \\
  --rows 1000 --seed 1337 \\
  --out fixtures/seed.csv --record fixtures/seed.record.json

# fail the build if it ever drifts out of range or is tampered with
npx safeseed verify --in fixtures/seed.csv --record fixtures/seed.record.json`;

const CI_ACTION = `# .github/workflows/ci.yml  — as a required check
- uses: tanjaminben/safeseed@v0
  with:
    data: fixtures/seed.csv
    record: fixtures/seed.record.json`;

export default function App() {
  const netCount = useNetworkCount();

  return (
    <div className="site">
      {/* MASTHEAD */}
      <header className="masthead">
        <span className="masthead-brand">
          <img className="fox-neon masthead-fox" src={foxLogo} alt="Advokat Frida" width={40} height={40} />
          <span className="masthead-lockup">
            <span className="masthead-mark">SAFESEED</span>
            <span className="masthead-kicker">Frida's Toolkit · No. 01</span>
          </span>
        </span>
        <span className="masthead-dateline">client-side · MIT · zero network</span>
      </header>

      <main className="site-main">
        {/* HERO */}
        <section className="hero">
          <div className="hero-lead">
            <h1 className="hero-headline">
              Trusted <span className="hl">synthetic</span> PII-shaped data
            </h1>
            <p className="hero-sub">
              Anonymous from the start, not scrubbed after the fact. Every value is fake by design — reserved,
              test-only, or self-evidently invented — so none of it relates to a real person.
            </p>
            <div className="verb-chips">
              <span className="verb-chip">Generate</span>
              <span className="verb-chip">Verify</span>
              <span className="verb-chip">Scan</span>
            </div>
            <a className="hero-cta" href="#proof">
              Run it yourself <span aria-hidden="true">↓</span>
            </a>
          </div>

          <aside className={`airgap ${netCount === 0 ? "quiet" : "tripped"}`} aria-label="Live network monitor">
            <div className="airgap-head">
              <span className="airgap-led" aria-hidden="true" />
              <span className="airgap-head-l">Live · network monitor</span>
              <span className="airgap-head-state">{netCount === 0 ? "nothing sent" : "call detected"}</span>
            </div>
            <div className="airgap-readout">
              <span className="airgap-n">{netCount}</span>
              <span className="airgap-l">
                network requests
                <br />
                this page has made
              </span>
            </div>
            <p className="airgap-cap">
              This page cannot contact any server. Nothing you type, generate, or scan ever leaves your browser, so
              the count above stays at zero. Open your browser's network tab and watch.
            </p>
            <p className="airgap-fine">
              Enforced in the shipped build by a Content-Security-Policy (<code>connect-src 'none'</code>) — the
              browser's own hard block on outbound connections.
            </p>
            <p className="airgap-teaser">
              <a href="#boundary">What this does, and doesn't, prove ↓</a>
            </p>
          </aside>
        </section>

        {/* HONESTY TIERS */}
        <section className="tiers">
          <h2 className="section-h">Three honesty tiers</h2>
          <p className="section-lead">
            Not every kind of fake data is fake in the same way, so each carries a different strength of guarantee. The
            color shows which, and every value on this page is tagged with its tier.
          </p>
          <div className="tier-cards">
            <div className="tier-card tier-provable">
              <span className="tier-dot" />
              <h3>Provably non-real</h3>
              <p>
                Set aside by a published standard, so it can never belong to a real person or system. Every source is
                public and checkable:{" "}
                <a href="https://datatracker.ietf.org/doc/html/rfc2606" target="_blank" rel="noreferrer">
                  RFC 2606
                </a>{" "}
                email domains,{" "}
                <a href="https://www.rfc-editor.org/rfc/rfc5737.html" target="_blank" rel="noreferrer">
                  RFC 5737
                </a>{" "}
                /{" "}
                <a href="https://www.rfc-editor.org/rfc/rfc3849.html" target="_blank" rel="noreferrer">
                  RFC 3849
                </a>{" "}
                IP addresses,{" "}
                <a href="https://www.nationalnanpa.com/" target="_blank" rel="noreferrer">
                  NANPA
                </a>{" "}
                555-01xx phone numbers, and{" "}
                <a href="https://www.ssa.gov/employer/randomization.html" target="_blank" rel="noreferrer">
                  never-issued SSN
                </a>{" "}
                ranges.
              </p>
            </div>
            <div className="tier-card tier-designated">
              <span className="tier-dot" />
              <h3>Designated test-only</h3>
              <p>
                A real-looking value that banks and payment systems publish on purpose for testing, like a test credit
                card number. Real processors are set up to reject it, so it looks like an ordinary card but pays for
                nothing.
              </p>
            </div>
            <div className="tier-card tier-fake">
              <span className="tier-dot" />
              <h3>Obviously fake on purpose</h3>
              <p>
                No standard reserves names or street addresses, so these are made plainly fake (like
                <code> TEST_Person_000142</code> or <code>123 Example Way</code>) instead of realistic — a realistic
                random name could accidentally match a real person.
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
                No model, no training data. Unlike AI synthesizers, there are no real records for it to memorize and
                leak.
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
                Point it at an existing CSV and, for the fields you name, it flags any value outside the reserved ranges
                as candidate real PII — a tripwire for real data that slipped into a test set.
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
          <CodeBlock code={CI_GENERATE} />
          <CodeBlock code={CI_ACTION} />
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
            The output itself is anonymous: drawn from never-real values, it relates to no natural person, so it is
            not personal data (GDPR Recital 26). That is a statement about the <strong>data</strong>, not a clean bill
            of health for your <strong>program</strong> — you still process real data elsewhere, and that still needs
            its lawful basis. Treat SafeSeed as a data-minimization and security control for non-production environments
            (evidence toward GDPR Art. 25 &amp; 32, SOC 2, and ISO 27001), not as a scope-out for privacy law overall.
          </p>
          <p>
            This data is deliberately low-fidelity. It is built to be safe and self-evidently fake, not to be
            statistically representative. If you need distributional realism, this is the wrong tool, on purpose.
          </p>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <p className="footer-note">
          <strong>No telemetry, no analytics, no network.</strong> Everything here runs in your browser — verify it in
          the network tab. Open source, MIT.
        </p>
        <div className="footer-sig">
          <img className="fox-neon footer-fox-img" src={foxLogo} alt="Advokat Frida" width={42} height={42} />
          <span className="footer-sig-lines">
            <a href="https://github.com/tanjaminben/safeseed">github.com/tanjaminben/safeseed</a>
            <span className="footer-sig-sub">Part of Advokat Frida · Frida's Toolkit</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
