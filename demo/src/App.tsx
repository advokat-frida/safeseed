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

const FAQS = [
  {
    q: 'Is "Designated for testing" an actual standard?',
    a: (
      <>
        It is official, but not a neutral standards-body reservation like the provable values. Card issuers and payment
        sandboxes (Stripe, Visa, and the like) publish these as their designated test numbers, so they are
        authoritative — but the safety is by agreement: real processors are configured to reject them. That is why they
        sit in their own tier, one notch below "provably non-real," which is safe by impossibility rather than by
        agreement.
      </>
    ),
  },
  {
    q: "Could a structurally-fake value coincidentally match a real person? Isn't that the risk with AI synthetic data?",
    a: (
      <>
        It is the same class of risk, and SafeSeed drives it to effectively zero by making every value unmistakably
        fake. Names and addresses are rendered as plain tokens like <code>TEST_Person_000142</code> and{" "}
        <code>123 Example Way</code>,
        never realistic ones, so no living person carries those values — alone or combined with other columns. AI
        synthesizers generate realistic names learned from real data, which can coincidentally (or by memorization)
        match real people. Refusing to look realistic is exactly what removes that risk.
      </>
    ),
  },
  {
    q: "Is this anonymization? Is the output GDPR-anonymous?",
    a: (
      <>
        No, and the distinction matters. Anonymization is a process you run on real data to strip identifiers, and it
        always carries some re-identification risk. SafeSeed never touches real data — the values are invented from
        never-real sources, so on their own they relate to no natural person (cf. GDPR Recital 26). That is a statement
        about the values in isolation, not a blanket ruling that privacy law no longer applies to your program.
      </>
    ),
  },
  {
    q: "My team wants to add their own columns (job title, industry) to the generated file. Won't that break verification?",
    a: (
      <>
        Whole-file verify will correctly flag it, because the file is no longer byte-for-byte what was generated — that
        is the point of tamper-evidence. For the "add your own non-PII columns" workflow, use <strong>scan</strong>{" "}
        instead: it checks the typed columns for real PII without depending on the original file. A column-scoped verify
        mode (attest the synthetic columns, allow extra ones) is on the roadmap to make that a first-class flow.
      </>
    ),
  },
  {
    q: "Does it work with anything other than CSV?",
    a: (
      <>
        CSV today, in the demo and the CLI. The core generates a format-agnostic table, so JSON, NDJSON, SQL inserts,
        and others are straightforward to add — the generate, verify, and scan logic does not depend on the format.
      </>
    ),
  },
  {
    q: "Does SafeSeed use encryption?",
    a: (
      <>
        No. Verify uses a SHA-256 content fingerprint, which is a one-way cryptographic hash, not encryption. It proves
        the file has not changed, not that it is secret. The run record is tamper-evidence, and the real assurance is
        the open, auditable code — not a signature, which would only prove the tool ran, not that it is correct.
      </>
    ),
  },
  {
    q: "How is this different from Faker or other fake-data libraries?",
    a: (
      <>
        Off-the-shelf libraries already emit reserved-range values; what is missing is the discipline around them.
        SafeSeed ties every PII field to a cited standard, enforces it (verify fails the build on drift), detects real
        data that slipped in (scan), and states its honesty tiers plainly. You can even wrap Faker for realistic non-PII
        fields and let the cited ranges own every PII-shaped one.
      </>
    ),
  },
  {
    q: "Does any of my data leave my machine?",
    a: (
      <>
        No. Everything runs in your browser — there is no backend, no telemetry, and no analytics. The shipped build
        enforces it with a Content-Security-Policy that blocks every outbound connection, and the live counter at the
        top of the page stays at zero. You can confirm it yourself in your browser's network tab.
      </>
    ),
  },
  {
    q: "An address like user@example.com — couldn't that be someone's dormant identity?",
    a: (
      <>
        No. RFC 2606 permanently reserves those names, so they can never be registered or owned by anyone. With no
        possible registrant there is no account and no dormant identity — the domain itself is non-assignable, not
        merely undeliverable.
      </>
    ),
  },
  {
    q: "What does SafeSeed deliberately not do?",
    a: (
      <>
        It does not prove your environment is clean (real data sitting beside the file, or a join to a production
        snapshot), it is not a lawful-basis or DSAR answer, and it is not statistically realistic — the data is
        low-fidelity on purpose. See <a href="#boundary">what this proves, and what it does not</a> above.
      </>
    ),
  },
];

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
              test-only, or structurally fake — so none of it relates to a real person.
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

          <aside className={`airgap ${netCount === 0 ? "quiet" : "tripped"}`} aria-label="Network activity monitor">
            <div className="airgap-head">
              <span className="airgap-led" aria-hidden="true" />
              <span className="airgap-head-l">Network monitor</span>
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
            Not all synthetic data is created the same way. Each color below is a different tier of honesty that carries
            a different strength of guarantee.
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
              <h3>Designated for testing</h3>
              <p>
                A real-looking value that banks and payment systems publish on purpose for testing, like a test credit
                card number. Real processors are set up to reject it, so it looks like an ordinary card but pays for
                nothing.
              </p>
            </div>
            <div className="tier-card tier-fake">
              <span className="tier-dot" />
              <h3>Structurally fake</h3>
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
                Re-check a file against its run record. A SHA-256 content fingerprint (a cryptographic hash, not
                encryption) confirms not one byte changed, and an independent range check confirms every value is still
                reserved. Wire it into CI to fail the build the moment data drifts.
              </p>
            </div>
            <div className="card op">
              <h3>Scan</h3>
              <p>
                Point it at an existing CSV and, for the fields you name, it flags any value outside the reserved ranges
                as candidate real PII. No generator and no setup — it runs on files you already have, so it catches real
                data that slipped into a test set.
              </p>
            </div>
          </div>
        </section>

        {/* PROOF PANEL (interactive centerpiece) */}
        <ProofPanel />

        {/* CI GATE */}
        <section className="cigate">
          <h2 className="section-h">Wire it into CI</h2>
          <p className="section-lead">The build fails if the data drifts out of range or is tampered with.</p>
          <CodeBlock code={CI_GENERATE} />
          <CodeBlock code={CI_ACTION} />
        </section>

        {/* BOUNDARY */}
        <section className="boundary" id="boundary">
          <h2 className="boundary-h">What this proves — and what it does not</h2>
          <div className="boundary-cols">
            <div className="boundary-col boundary-proves">
              <h3>
                <span className="b-mark" aria-hidden="true">✓</span> What it proves
              </h3>
              <ul>
                <li>
                  Every value was drawn from a reserved, designated-test, or structurally-fake source, and the file
                  hasn't changed since it was generated.
                </li>
                <li>
                  The generated values are <strong>anonymous</strong> on their own — they relate to no natural person,
                  so in isolation they are not personal data (cf. GDPR Recital 26).
                </li>
                <li>A tamper-evident record binds that exact file by its content fingerprint.</li>
                <li>Zero network: nothing you do here ever leaves your browser.</li>
              </ul>
            </div>
            <div className="boundary-col boundary-not">
              <h3>
                <span className="b-mark" aria-hidden="true">✗</span> What it does not
              </h3>
              <ul>
                <li>
                  That your <strong>environment</strong> is clean — no real data sitting beside this file, no join to a
                  production snapshot.
                </li>
                <li>That your wider processing has a lawful basis. This is a control, not a program-wide scope-out.</li>
                <li>Statistical realism — the data is deliberately low-fidelity, not representative.</li>
                <li>
                  That a file edited <em>after</em> generation is still safe — re-run verify or scan to confirm.
                </li>
              </ul>
            </div>
          </div>
          <p className="boundary-close">
            In short: SafeSeed makes "no production data crossed this line" a property you can check on every run, and it
            states plainly where that guarantee ends. Use it as a data-minimization and security control for
            non-production environments (evidence toward GDPR Art. 25 &amp; 32, SOC 2, and ISO 27001), not as a
            substitute for your program's own privacy work.
          </p>
        </section>

        {/* FAQ */}
        <section className="faq" id="faq">
          <h2 className="section-h">Questions a skeptic asks first</h2>
          <p className="section-lead">The honest answers — including where the guarantee stops.</p>
          <div className="faq-list">
            {FAQS.map((item, i) => (
              <details className="faq-item" key={i}>
                <summary>{item.q}</summary>
                <div className="faq-a">{item.a}</div>
              </details>
            ))}
          </div>
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
