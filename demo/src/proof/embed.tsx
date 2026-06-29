import { createRoot } from "react-dom/client";
import ProofPanel, { ScanStep } from "../components/ProofPanel";
import indexCss from "../index.css?inline";

// The demo stylesheet, scoped into the shadow root. The design tokens live on :root in
// the source; inside a shadow tree :root never matches, so rewrite it to :host — custom
// properties set on :host still inherit down into the shadow tree. (#root is a hash id,
// not the :root pseudo-class, so the \b keeps it untouched.) The body/#root rules in the
// source then no-op harmlessly inside the shadow, so the inherited text styles they used
// to carry are restated on :host below.
const SHADOW_CSS =
  indexCss.replace(/:root\b/g, ":host") +
  `
:host {
  /* Match the host article (Advokat Frida / Dispatch). Its body + heading font is
     Space Grotesk, loaded at the document level so it pierces into this shadow tree;
     override the demo's Inter/Libre-Baskerville tokens so the panel reads as part of the
     article, not a foreign widget. Scoped to :host, so the standalone demo keeps its fonts. */
  --sans: "Space Grotesk", system-ui, -apple-system, sans-serif;
  --serif: "Space Grotesk", system-ui, -apple-system, sans-serif;
  --mono: "SFMono-Regular", Menlo, Consolas, monospace;

  /* Scale the demo's type up to the article's reading column. The demo was authored at a
     17px body baseline, so inside the article (~19.8px reading) it looked shrunken — you had
     to zoom to read it. These remap the demo tokens onto the article's scale: explanatory
     prose ~18px, data/tables ~16px, step heads = the article's h3. */
  --fs-section: 28px;
  --fs-h3: 24px;
  --fs-h4: 20px;
  --fs-lead: 20px;
  --fs-body: 20px;
  --fs-small: 18px;
  --fs-meta: 16px;
  --fs-micro: 13.5px;

  display: block;
  box-sizing: border-box;
  background: var(--parchment);
  border: 3px solid #1f1d18;
  color: var(--ink);
  font-family: var(--sans);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  letter-spacing: normal;
  text-align: left;
  padding: 1.25rem 1.25rem 1.5rem;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
/* The article already introduces the panel with its own "Live demo" h2 + intro prose, so
   drop the panel's own "See it for yourself" heading and blurb (keep the colour-key legend). */
.proof-head h2,
.proof-head p {
  display: none;
}
/* In the embed, the dark :host border (or the wrapping card) is the frame, so drop the demo's
   own inner .proof border -- otherwise it double-frames (a teal box inside the dark one). Keep
   its wide side padding: that (plus :host) sets the card's consistent ~50px side gutter, and the
   network-monitor frame is padded to match it. Trim only the TOP so the demo's legend sits right
   under the monitor's divider instead of a big empty band. */
.proof { margin: 0; border: none; padding-top: 14px; }
/* When fused into the Live-demo card (the monitor + the demo share one frame), drop the
   panel's own border so the wrapping card provides the single border. */
:host(.in-demo-card) { border: none; padding-top: 0; }
/* Scan-only mount ("Try it with your own data"): no extra top padding above the one step,
   and drop the "4" step number -- it's the only step here, so a number reads oddly. */
:host(.safeseed-scan-only) .proof-scan-only .step { margin-top: 0; }
:host(.safeseed-scan-only) .step-n { display: none; }
`;

// A true inline mount: a custom element that renders the interactive proof into its own
// shadow root. The article's CSS can't reach in and the panel's CSS can't leak out, with
// no iframe — so it simply flows in the page and reflows with the reading column, no
// auto-fit measuring, no inner scrollbar.
class SafeSeedProof extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return; // guard against re-entry if the node is moved in the DOM
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);
    const mount = document.createElement("div");
    shadow.appendChild(mount);
    // The "Try it with your own data" mount carries class="safeseed-scan-only" and renders only
    // the standalone scanner (paste your own CSV), not the full Generate->Attest->Verify->Scan loop.
    const scanOnly = this.classList.contains("safeseed-scan-only");
    createRoot(mount).render(
      scanOnly ? (
        <section className="proof proof-scan-only" aria-label="Scan your own data">
          <ScanStep />
        </section>
      ) : (
        <ProofPanel />
      ),
    );
  }
}

if (!customElements.get("safeseed-proof")) {
  customElements.define("safeseed-proof", SafeSeedProof);
}
