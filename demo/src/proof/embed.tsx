import { createRoot } from "react-dom/client";
import ProofPanel, { ScanStep } from "../components/ProofPanel";
import indexCss from "../index.css?inline";
import skinCss from "../demo-skin.css?inline";

// The demo stylesheet, scoped into the shadow root. The design tokens live on :root in
// the source; inside a shadow tree :root never matches, so rewrite it to :host — custom
// properties set on :host still inherit down into the shadow tree. (#root is a hash id,
// not the :root pseudo-class, so the \b keeps it untouched.) The body/#root rules in the
// source then no-op harmlessly inside the shadow, so the inherited text styles they used
// to carry are restated on :host below.
//
// demo-skin.css rides along because it IS the article house style (Space Grotesk, the
// forest accent, square 2px-ink cards) — the same repaint the standalone demo gets. Without
// it the embed kept index.css's neutral skin: teal accents, 1px hairline borders and 8px
// radii sitting inside an article built from square ink-edged blocks. Its @font-face blocks
// no-op inside a shadow tree (Space Grotesk is already loaded at the document level) and
// its font-SIZE tokens are the standalone page's scale, overridden on :host below.
const SHADOW_CSS =
  indexCss.replace(/:root\b/g, ":host") +
  skinCss.replace(/:root\b/g, ":host") +
  `
:host {
  /* Match the host article (Advokat Frida / Dispatch). Its body + heading font is
     Space Grotesk, loaded at the document level so it pierces into this shadow tree;
     override the demo's Inter/Libre-Baskerville tokens so the panel reads as part of the
     article, not a foreign widget. Scoped to :host, so the standalone demo keeps its fonts. */
  --sans: "Space Grotesk", system-ui, -apple-system, sans-serif;
  --serif: "Space Grotesk", system-ui, -apple-system, sans-serif;
  --mono: "SFMono-Regular", Menlo, Consolas, monospace;

  /* The article's real reading scale, measured off the rendered page: body prose is 16px
     and h2 is 24px. An earlier pass assumed ~19.8px and scaled the panel to a 20px baseline,
     which left the whole embed roughly a quarter larger than the prose around it and pushed
     the six-column exhibit into a horizontal scrollbar. These track the article instead:
     prose 16px, step heads a notch under the article's h2, data/tables 13px. */
  --fs-section: 24px;
  --fs-h3: 19px;
  --fs-h4: 17px;
  --fs-lead: 17px;
  --fs-body: 16px;
  --fs-small: 15px;
  --fs-meta: 13px;
  --fs-micro: 11px;

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
/* Tighter cells than the standalone page: the exhibit carries six columns of monospace
   PII, and the default 8px/12px padding is what tips it over the available width. The
   target is the narrowest width that still gets the wide breakout (a ~1025px viewport,
   which leaves the panel about 750px of usable table). */
table.data td,
table.data th { padding: 6px 8px; }
/* The citation chips under each column name are the widest thing in the header row
   ("Structurally fake" alone outruns its column's data), so let them wrap rather than
   set a floor on the column width. */
table.data th .cite-chip { white-space: normal; text-align: left; }
/* Between the grid's 1024px collapse and roughly 1120px the breakout only borrows a
   sliver of the sidenote track, leaving the exhibit a few dozen pixels short. Step the
   data down one notch there so all six columns still land without a scrollbar. */
@media (max-width: 1120px) {
  table.data { font-size: 12px; }
  table.data td,
  table.data th { padding: 5px; }
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
    // the standalone scanner (paste your own CSV), not the full Generate->Record->Verify->Scan loop.
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
