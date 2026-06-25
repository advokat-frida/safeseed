import { useState, useSyncExternalStore } from "react";
import { Table2, ShieldCheck, ScanSearch } from "lucide-react";
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
        It is official, but not a neutral standards-body reservation like the provable values. Payment platforms publish
        these as their designated test numbers — see, for example, Stripe's{" "}
        <a href="https://docs.stripe.com/testing" target="_blank" rel="noreferrer">
          testing docs
        </a>
        ; other processors publish their own equivalents. So they are authoritative, but the safety is by agreement: real
        processors are configured to reject them. That is why they sit in their own tier, below both "provably non-real"
        (safe by protocol impossibility) and "reserved, never issued" (a number the authority never assigns) — a test
        card is a perfectly valid number, kept safe only because processors agree to refuse it.
      </>
    ),
  },
  {
    q: "Could a structurally fake value coincidentally match a real person? Isn't that the risk with AI synthetic data?",
    a: (
      <>
        Honest answer: this tier does not claim impossibility — that is the provable tier, and the difference matters.
        The values are built to be unmistakably synthetic: <code>TEST_Person_000142</code> has a TEST_ prefix, an
        underscore, and a zero-padded counter, and addresses use the placeholder word "Example", so neither resembles
        anything a real registry would issue. A real match is therefore <strong>vanishingly unlikely</strong> — for
        names and addresses, vanishingly unlikely but not impossible, and that honesty is exactly why this is the lowest
        tier. The decisive safeguard is that <strong>no real data ever enters the
        generator</strong>, so even if a string coincidentally matched a real name, it carries no information about and
        no link to that person — the coincidence is inert. AI synthesizers are the opposite: they emit realistic values,
        and a "coincidence" there can be the model regurgitating a real record it memorized. So: provable tier =
        impossible; structurally fake tier = vanishingly unlikely and informationally inert, by design.
      </>
    ),
  },
  {
    q: "Is this anonymization? Is the output GDPR-anonymous?",
    a: (
      <>
        No, and the distinction matters. Anonymization is a process you run on real data to strip identifiers, and it
        always carries some re-identification risk. SafeSeed never touches real data — the values are invented from
        never-real sources, so on their own they relate to no natural person (cf.{" "}
        <a href="https://gdpr-info.eu/recitals/no-26/" target="_blank" rel="noreferrer">
          GDPR Recital 26
        </a>
        ). That is a statement about the values in isolation, not a blanket ruling that privacy law no longer applies to
        your program.
      </>
    ),
  },
  {
    q: "My team wants to add their own columns (job title, industry) to the generated file. Won't that break verification?",
    a: (
      <>
        Two honest options. Strict whole-file verify (the default) will flag the change, because the file is no longer
        byte-for-byte what was generated — that is the point of tamper-evidence. When you do want to add your own
        business columns, use <strong>column-scoped verify</strong>: <code>safeseed verify --allow-added-columns</code>
        attests the synthetic columns SafeSeed generated (each by name, hash, and range) and reports the columns you
        added as <em>unattested</em> rather than failing — it does not vouch for them, so point <strong>Scan</strong> at
        those (Scan reads any file and flags values outside a reserved range, no run record needed). The{" "}
        <a href="./generator.html">generator</a> downloads a run record ready for this flow.
      </>
    ),
  },
  {
    q: "Does it work with anything other than CSV?",
    a: (
      <>
        CSV today, and a CSV opens directly in Excel or Google Sheets. More formats (JSON, SQL — see the format selector
        in the Scan step above) are straightforward to add, because the data is built as a plain table first and the file
        format is only the final step.
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
    q: "In practice, what do I do with the run record and its SHA-256 fingerprint?",
    a: (
      <>
        You save the run record as a small JSON file next to your data (for example <code>seed.csv</code> and{" "}
        <code>seed.record.json</code>) and commit both — nothing is sent anywhere, and the fingerprint protects nothing,
        it only lets anyone recompute and compare. Later, in CI or by hand, you run{" "}
        <code>safeseed verify --in seed.csv --record seed.record.json</code>: it re-derives the fingerprint from the
        file, checks it against the record, and re-checks every value's range. A match means untouched; a mismatch fails
        the build. The fingerprint is a SHA-256 hash, not a key or a secret, so there is nothing to store securely or
        rotate.
      </>
    ),
  },
  {
    q: "How is this different from Faker or other fake-data libraries?",
    a: (
      <>
        Off-the-shelf libraries already emit reserved-range values; what is missing is the discipline around them.
        SafeSeed ties every PII-shaped field to a cited standard, enforces it (verify fails the build on drift), audits
        named columns against their reserved ranges (scan), and states its honesty tiers plainly. You can even wrap
        Faker for realistic non-PII fields and let the cited ranges own every PII-shaped one.
      </>
    ),
  },
  {
    q: "Does any of my data leave my machine?",
    a: (
      <>
        No. Everything runs in your browser — there is no backend, no telemetry, and no analytics. The shipped build
        enforces it with a Content-Security-Policy that blocks every outbound connection, and the live counter at the
        top of the page stays at zero unless you press the test button yourself. You can confirm it in your browser's
        network tab.
      </>
    ),
  },
  {
    q: "An address like user1@example.com — couldn't that be someone's dormant identity?",
    a: (
      <>
        No.{" "}
        <a href="https://datatracker.ietf.org/doc/html/rfc2606" target="_blank" rel="noreferrer">
          RFC 2606
        </a>{" "}
        permanently reserves those names, so they can never be registered or owned by anyone. With no possible
        registrant there is no account and no dormant identity — the domain itself is non-assignable, not merely
        undeliverable.
      </>
    ),
  },
  {
    q: "What does SafeSeed deliberately not do?",
    a: (
      <>
        It does not prove your environment is clean (real data sitting beside the file, or a join to a production
        snapshot), it is not a lawful-basis or DSAR answer, and it does not look like your real data — the values are
        deliberately fake and uniform, so they are wrong for anything that needs lifelike data (training a model,
        analytics, realistic load tests). See <a href="#boundary">what this proves, and what it does not</a> above.
      </>
    ),
  },
];

export default function App() {
  const netCount = useNetworkCount();

  // Deliberately attempt an outbound request to prove the guard. netGuard counts it the
  // instant it fires; the shipped build's CSP (connect-src 'none') then refuses the
  // connection. example.com is RFC 2606's reserved demo domain, so nothing meaningful is hit.
  const tryEgress = () => {
    window.fetch("https://example.com/safeseed-egress-test", { mode: "no-cors" }).catch(() => {});
  };

  return (
    <div className="site">
      <div className="demo-banner" role="note">
        <strong>Demo — work in progress.</strong> Not for distribution or production use.
      </div>
      {/* MASTHEAD */}
      <header className="masthead">
        <span className="masthead-brand">
          <img className="fox-neon masthead-fox" src={foxLogo} alt="Advokat Frida" width={72} height={72} />
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
              Anonymous from the start, not scrubbed after the fact. Every value is fake by design — provably non-real,
              reserved and never issued, designated for testing, or structurally fake — so none of it relates to a real
              person, and a built-in receipt lets you prove, any time, that it hasn't changed since.
            </p>
            <div className="verb-chips">
              <span className="verb-chip">
                <Table2 className="verb-icon" aria-hidden="true" /> Generate
              </span>
              <span className="verb-chip">
                <ShieldCheck className="verb-icon" aria-hidden="true" /> Verify
              </span>
              <span className="verb-chip">
                <ScanSearch className="verb-icon" aria-hidden="true" /> Scan
              </span>
            </div>
            <div className="hero-ctas">
              <a className="hero-cta" href="#proof">
                Run it yourself <span aria-hidden="true">↓</span>
              </a>
              <a className="hero-cta-alt" href="./generator.html">
                Open the generator <span aria-hidden="true">→</span>
              </a>
            </div>
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
              {netCount === 0
                ? "This page cannot contact any server. Nothing you type, generate, or scan ever leaves your browser, and you don't have to take my word for it. Test it:"
                : "Caught. The attempt was counted the instant it fired, and in the shipped build the Content-Security-Policy refuses the connection outright. Check the failed request in your network tab."}
            </p>
            <button type="button" className="btn airgap-probe" onClick={tryEgress}>
              {netCount === 0 ? "Send a network request" : "Try again"}
            </button>
            <p className="airgap-fine">
              This button fires a real outbound request to <code>example.com</code> (a reserved test domain). The counter
              above ticks the instant the attempt is made, so you can see for yourself that it was tried.
            </p>
            <p className="airgap-fine">
              Enforced in the shipped build by a Content-Security-Policy (<code>connect-src 'none'</code>) — the
              browser's own hard block on outbound connections, so the request never actually leaves.
            </p>
            <p className="airgap-teaser">
              <a href="#boundary">What this does and doesn't prove ↓</a>
            </p>
          </aside>
        </section>

        {/* THREE OPERATIONS — what the product does */}
        <section className="ops">
          <h2 className="section-h">One small library, three jobs</h2>
          <div className="op-cards">
            <div className="card op">
              <h3>
                <Table2 className="op-icon" aria-hidden="true" /> Generate
              </h3>
              <p>Produce test data from cited reserved ranges, deterministically from a seed.</p>
              <p className="op-note">
                No model, no training data. Unlike AI synthesizers, there are no real records for it to memorize and
                leak.
              </p>
            </div>
            <div className="card op">
              <h3>
                <ShieldCheck className="op-icon" aria-hidden="true" /> Verify
              </h3>
              <p>
                Prove a file hasn't changed since you generated it — a content fingerprint plus a range check, in one
                command.
              </p>
              <p className="op-note">
                Wire it into CI to fail the build the moment the data drifts out of range or is altered.
              </p>
            </div>
            <div className="card op">
              <h3>
                <ScanSearch className="op-icon" aria-hidden="true" /> Scan
              </h3>
              <p>Audit a file you already have. For the columns you name, it flags any value outside its reserved range.</p>
              <p className="op-note">
                No generator and no run record needed — point it at any CSV and review what it surfaces.
              </p>
            </div>
          </div>
        </section>

        {/* HONESTY TIERS — how it does it */}
        <section className="tiers">
          <h2 className="section-h">Four honesty tiers</h2>
          <p className="section-lead">
            Not all synthetic data is created the same way. Each color below is a different tier of honesty that carries
            a different strength of guarantee.
          </p>
          <div className="tier-cards">
            <div className="tier-card tier-provable">
              <span className="tier-dot" />
              <h3>Provably non-real</h3>
              <p>
                Set aside by a published standard, so it can never belong to a real person or system. The standard
                reserves them, so no real registrant or network is ever assigned one, and every source is public and
                checkable:{" "}
                <a href="https://datatracker.ietf.org/doc/html/rfc2606" target="_blank" rel="noreferrer">
                  RFC 2606
                </a>{" "}
                email domains, and{" "}
                <a href="https://www.rfc-editor.org/rfc/rfc5737.html" target="_blank" rel="noreferrer">
                  RFC 5737
                </a>{" "}
                /{" "}
                <a href="https://www.rfc-editor.org/rfc/rfc3849.html" target="_blank" rel="noreferrer">
                  RFC 3849
                </a>{" "}
                documentation IP addresses.
              </p>
            </div>
            <div className="tier-card tier-reserved">
              <span className="tier-dot" />
              <h3>Reserved, never issued</h3>
              <p>
                Valid in format, but the issuing authority sets these aside and never assigns them, so no real holder
                has one. Strong, though it rests on administrative policy rather than protocol:{" "}
                <a href="https://www.nanpa.com/" target="_blank" rel="noreferrer">
                  NANPA
                </a>{" "}
                555-01xx fictitious phone numbers, and{" "}
                <a href="https://www.ssa.gov/employer/randomization.html" target="_blank" rel="noreferrer">
                  never-issued SSN
                </a>{" "}
                ranges (SSA randomization).
              </p>
            </div>
            <div className="tier-card tier-designated">
              <span className="tier-dot" />
              <h3>Designated for testing</h3>
              <p>
                A real-looking value that banks and payment systems publish on purpose for testing, like a test credit
                card number. Real processors are configured to reject it, so it looks like an ordinary card but pays for
                nothing. Published by payment processors for testing — see, for example,{" "}
                <a href="https://docs.stripe.com/testing" target="_blank" rel="noreferrer">
                  Stripe's test numbers
                </a>
                ; other processors publish their own.
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

        {/* PROOF PANEL (interactive centerpiece) */}
        <ProofPanel />

        {/* CI GATE */}
        <section className="cigate">
          <h2 className="section-h">Wire it into CI/CD</h2>
          <p className="section-lead">
            Drop it into your pipeline — the build fails if the data drifts out of range or is tampered with.
          </p>
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
                  Every value came from one of the four honesty tiers — provably non-real, reserved and never issued,
                  designated for testing, or structurally fake — and the file hasn't changed since it was generated.
                </li>
                <li>
                  The generated values are <strong>anonymous</strong> on their own — they relate to no identified or
                  identifiable person, so they are not personal data within the meaning of{" "}
                  <a href="https://gdpr-info.eu/art-4-gdpr/" target="_blank" rel="noreferrer">
                    GDPR Art. 4(1)
                  </a>{" "}
                  (cf.{" "}
                  <a href="https://gdpr-info.eu/recitals/no-26/" target="_blank" rel="noreferrer">
                    Recital 26
                  </a>
                  ).
                </li>
                <li>A tamper-evident record binds that exact file by its content fingerprint.</li>
                <li>Zero network: nothing you do here ever leaves your browser.</li>
              </ul>
            </div>
            <div className="boundary-col boundary-not">
              <h3>
                <span className="b-mark" aria-hidden="true">✗</span> What it does not prove
              </h3>
              <ul>
                <li>
                  It does not prove your <strong>environment</strong> is clean — no real data sitting beside this file,
                  no join to a production snapshot.
                </li>
                <li>
                  It does not establish a lawful basis for your wider processing. This is a control, not a program-wide
                  scope-out.
                </li>
                <li>
                  It does not make the data resemble your real data — the values are deliberately fake and uniform, so
                  they're wrong for anything that needs lifelike data (model training, analytics, realistic load tests).
                </li>
                <li>
                  It does not <strong>find or classify PII in your real data.</strong> SafeSeed only proves the data it
                  made is synthetic and unaltered; it is not a discovery or detection tool.
                </li>
              </ul>
            </div>
          </div>
          <p className="boundary-close">
            In short: SafeSeed lets you prove, on every run, that the data it generated is synthetic and hasn't changed
            since — and it is honest about where that proof ends. Use it as a data-minimization and security control for
            non-production environments (specifically evidence toward GDPR Art.{" "}
            <a href="https://gdpr-info.eu/art-25-gdpr/" target="_blank" rel="noreferrer">
              25
            </a>{" "}
            &amp;{" "}
            <a href="https://gdpr-info.eu/art-32-gdpr/" target="_blank" rel="noreferrer">
              32
            </a>
            , SOC 2, and ISO 27001). This
            should not be used as a substitute for your own privacy diligence.
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
          <img className="fox-neon footer-fox-img" src={foxLogo} alt="" aria-hidden="true" width={42} height={42} />
          <span className="footer-sig-lines">
            <a href="https://github.com/tanjaminben/safeseed">github.com/tanjaminben/safeseed</a>
            <span className="footer-sig-sub">Part of Advokat Frida · Frida's Toolkit</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
