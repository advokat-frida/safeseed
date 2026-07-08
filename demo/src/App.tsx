import { Table2, ShieldCheck, ScanSearch } from "lucide-react";
import ProofPanel from "./components/ProofPanel";
import foxLogo from "./assets/fox-logo.png";

export default function App() {
  return (
    <div className="site">
      <div className="demo-banner" role="note">
        <strong>Demo version.</strong> Not for distribution or production use.
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
            <a href="https://github.com/advokat-frida/safeseed">github.com/advokat-frida/safeseed</a>
            <span className="footer-sig-sub">Part of Advokat Frida · Frida's Toolkit</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
