import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

// The demo consumes the built SafeSeed core exactly as an external user would:
// `import { generate } from "safeseed"` resolves to the package's dist build.
const safeseedEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

// Inline the favicon as a data URI at build time. Otherwise the <link rel="icon"
// href="/fox.svg"> stays an external request, which the single-file artifact opened
// from disk (file://) can't resolve and the strict `img-src data:` CSP blocks — a
// blocked request in the network tab is the wrong look for a "zero network" demo.
const faviconSvg = readFileSync(fileURLToPath(new URL("./public/fox.svg", import.meta.url)), "utf8");
const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;

function inlineFaviconOnBuild() {
  return {
    name: "inline-favicon-on-build",
    apply: "build" as const,
    // Run post so we replace whatever Vite's asset rewrite left (/fox.svg, ./fox.svg, …).
    transformIndexHtml: {
      order: "post" as const,
      handler(html: string) {
        return html.replace(/href="[^"]*fox\.svg"/, `href="${faviconDataUri}"`);
      },
    },
  };
}

// The shipped artifact's selling point is "nothing leaves your device", so every
// build carries a strict CSP. connect-src 'none' = no network at all; font-src 'self'
// so a remote webfont can never be introduced by a future edit. Injected at build
// time only, so the dev server's HMR still works.
//   - hosted build: external script bundle -> script-src 'self'.
//   - standalone (single-file) build: the script is inlined into the HTML, so it
//     must allow inline script. Everything is first-party, there are no external
//     origins, and connect-src 'none' still holds.
const HOSTED_CSP =
  "default-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'";
const STANDALONE_CSP =
  "default-src 'none'; connect-src 'none'; img-src data:; font-src 'self'; " +
  "style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

function strictCspOnBuild(csp: string) {
  return {
    name: "strict-csp-on-build",
    apply: "build" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        "</title>",
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

// Two pages now: the showcase (index.html) and the self-serve generator
// (generator.html). The hosted build emits both as a normal multi-page site. Each
// standalone single-file build targets ONE page, because vite-plugin-singlefile
// inlines per build — so there's a mode per page (`standalone` = showcase,
// `standalone-generator` = generator), each a single rollup input.
const indexEntry = fileURLToPath(new URL("./index.html", import.meta.url));
const generatorEntry = fileURLToPath(new URL("./generator.html", import.meta.url));
const proofEntry = fileURLToPath(new URL("./proof.html", import.meta.url));

export default defineConfig(({ mode }) => {
  const standaloneShowcase = mode === "standalone";
  const standaloneGenerator = mode === "standalone-generator";
  const standaloneProof = mode === "standalone-proof";
  const standalone = standaloneShowcase || standaloneGenerator || standaloneProof;
  return {
    plugins: [
      react(),
      inlineFaviconOnBuild(),
      strictCspOnBuild(standalone ? STANDALONE_CSP : HOSTED_CSP),
      ...(standalone ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: { safeseed: safeseedEntry },
      // lucide-react (and any future React dep) must share the demo's single React
      // copy — otherwise icons render against a second instance and throw the
      // "Invalid hook call" duplicate-React error.
      dedupe: ["react", "react-dom"],
    },
    build: {
      // Inline the fox PNG (~160KB) so even the logo is a zero-request data URI —
      // on-brand for the zero-network claim, and required for the single-file build.
      assetsInlineLimit: 200000,
      outDir: standaloneProof
        ? "standalone-proof"
        : standaloneGenerator ? "standalone-generator" : standaloneShowcase ? "standalone" : "dist",
      emptyOutDir: true,
      rollupOptions: standalone
        ? { input: standaloneProof ? proofEntry : standaloneGenerator ? generatorEntry : indexEntry }
        : { input: { main: indexEntry, generator: generatorEntry } },
    },
    server: { port: 5192, strictPort: true },
    preview: { port: 5192, strictPort: true },
  };
});
