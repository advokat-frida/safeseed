import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The demo consumes the built SafeSeed core exactly as an external user would:
// `import { generate } from "safeseed"` resolves to the package's dist build.
const safeseedEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

// The shipped artifact's selling point is "nothing leaves your device", so the
// production build carries a strict CSP (connect-src 'none' = no network at all).
// It is injected at build time only, so the dev server's HMR still works.
const PROD_CSP =
  "default-src 'self'; connect-src 'none'; img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'";

function strictCspOnBuild() {
  return {
    name: "strict-csp-on-build",
    apply: "build" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        "</title>",
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${PROD_CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), strictCspOnBuild()],
  resolve: {
    alias: { safeseed: safeseedEntry },
  },
  server: { port: 5192, strictPort: true },
  preview: { port: 5192, strictPort: true },
});
