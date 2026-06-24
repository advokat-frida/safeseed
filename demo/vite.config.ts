import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

// The demo consumes the built SafeSeed core exactly as an external user would:
// `import { generate } from "safeseed"` resolves to the package's dist build.
const safeseedEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

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

export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";
  return {
    plugins: [
      react(),
      strictCspOnBuild(standalone ? STANDALONE_CSP : HOSTED_CSP),
      ...(standalone ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: { safeseed: safeseedEntry },
    },
    build: {
      // Inline the fox PNG (~160KB) so even the logo is a zero-request data URI —
      // on-brand for the zero-network claim, and required for the single-file build.
      assetsInlineLimit: 200000,
      outDir: standalone ? "standalone" : "dist",
      emptyOutDir: true,
    },
    server: { port: 5192, strictPort: true },
    preview: { port: 5192, strictPort: true },
  };
});
