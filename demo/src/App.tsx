import { Table2, ShieldCheck, ScanSearch } from "lucide-react";
import ProofPanel from "./components/ProofPanel";

export default function App() {
  return (
    <div className="site">
      <header className="site-bar">
        <a className="bar-wordmark" href="https://advokatfrida.com/">Advokat Frida</a>
        <nav className="bar-nav" aria-label="Sections">
          <ul>
            <li><a href="https://advokatfrida.com/tag/fridas-desk/">Frida&rsquo;s Desk</a></li>
            <li><a href="https://advokatfrida.com/tag/field-guides/">Field Guides</a></li>
            <li><a href="https://advokatfrida.com/tag/toolkit/">Toolkit</a></li>
            <li><a href="https://advokatfrida.com/members/">The Den</a></li>
            <li><a href="https://advokatfrida.com/about/">About</a></li>
          </ul>
        </nav>
      </header>
      <div className="demo-banner" role="note">
        <strong>Demo version.</strong> Not for distribution or production use.
      </div>

      <main className="site-main">
        {/* HERO */}
        <section className="hero">
          <div className="hero-lead">
            <h1 className="hero-headline">
              Trusted <span className="hl">synthetic</span> PII-shaped data
            </h1>
            <p className="hero-sub">
              Anonymous from the start, not scrubbed after the fact. Every value is fake by design — drawn from ranges
              no real person can hold (provably non-real, reserved and never issued, designated for testing) or built
              to be self-evidently fake — and a built-in receipt lets you prove, any time, that it hasn't changed since.
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
              {/* The committed/deployed single-file is named safeseed-generator.html —
                  ./generator.html only exists inside the dev build and 404s live. */}
              <a className="hero-cta-alt" href="./safeseed-generator.html">
                Open the generator <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* PROOF PANEL (interactive centerpiece) */}
        <ProofPanel />

        <p className="finelegal">
          <strong>Not legal advice.</strong> SafeSeed proves test data is synthetic and unchanged — it doesn't make any
          use of it compliant, and a human stays accountable for anything that leaves the building.
        </p>
      </main>

      <footer className="site-colophon">
        <div className="site-colophon-inner">
          <div className="site-colophon-brand">
            <p className="site-colophon-name">Advokat Frida</p>
            <p className="site-colophon-desc">Privacy and AI governance, by design and in practice.<br />Runs entirely in your browser, cookieless and local &mdash; nothing you type leaves the page.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="site-colophon-nav">
              <li><a href="https://advokatfrida.com/about/">About</a></li>
              <li><a href="https://advokatfrida.com/tag/toolkit/">Toolkit</a></li>
              <li><a href="https://advokatfrida.com/rss/">RSS</a></li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
