import { useSyncExternalStore } from "react";
import { Table2, ShieldCheck, ScanSearch } from "lucide-react";
import ProofPanel from "./components/ProofPanel";
import { getNetworkCount, subscribeNetworkCount } from "./netGuard";
import foxLogo from "./assets/fox-logo.png";

function useNetworkCount() {
  return useSyncExternalStore(subscribeNetworkCount, getNetworkCount);
}

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
          </aside>
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
            <a href="https://github.com/tanjaminben/safeseed">github.com/tanjaminben/safeseed</a>
            <span className="footer-sig-sub">Part of Advokat Frida · Frida's Toolkit</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
