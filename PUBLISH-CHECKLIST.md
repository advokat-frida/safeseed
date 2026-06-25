# Publishing SafeSeed to npm

The package is shaped and ready. Two ways to publish: the **recommended CI route** (push a version tag from any machine — the GitHub Action publishes, no local npm login, no interactive 2FA, no being-at-the-rig), or a **manual publish** from a logged-in machine. Both need a one-time bit of your npm account; neither can be done for you (your credentials).

## Status (as of 2026-06-24)

- **Name `safeseed` is available** on npm (registry returns 404 — not taken).
- `package.json` is publish-shaped: `main`, `types`, `bin` (`safeseed` → `dist/cli.js`), `exports`, and a `files` allowlist (`dist`, `README.md`, `LICENSE`) are all set.
- `prepublishOnly: "npm run build"` is wired, so `dist/` is rebuilt fresh on every publish — you can't accidentally ship a stale build.
- `repository` / `homepage` / `bugs` metadata added so the npm page links back to the repo.
- Current version: **0.2.0**.

## Recommended: release via CI (publish from any machine)

A `Release` workflow (`.github/workflows/release.yml`) publishes to npm when you push a version tag, with build-origin **provenance**. After a one-time token setup you never need a local npm login, an interactive 2FA prompt, or a specific machine — so this works fine while you're remote and the rig is elsewhere.

**One-time setup (your npm account — done once):**
1. npmjs.com → your avatar → **Access Tokens** → **Generate New Token** → **Automation** (Automation tokens publish from CI without an OTP prompt). Copy it.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, name it **`NPM_TOKEN`**, paste the token.
   *(Both steps are yours — I can't enter npm credentials or set repo secrets.)*

**To release (from anywhere, no login):**
```
npm version patch        # or minor / major — bumps package.json AND creates the v… tag
git push --follow-tags
```
The Action verifies the tag matches `package.json`, runs typecheck + tests + build, then `npm publish --provenance --access public`. Watch it under the repo's **Actions** tab. The first run creates the package.

## Pre-flight (no account needed — safe to run anytime)

1. Clean install + full gate:
   ```
   npm ci && npm run typecheck && npm test && npm run build
   ```
2. **See exactly what would publish** (dry run, nothing leaves your machine):
   ```
   npm pack --dry-run
   ```
   Confirm the tarball contains only `dist/**`, `README.md`, `LICENSE`, `package.json` — no `src`, no tests, no `examples`.
3. Decide the version. `0.2.0` is fine for a first public release; bump with `npm version patch|minor` if you want a clean `1.0.0` or to move past the pre-public 0.2.x.

## Manual publish (alternative — from a machine you're logged in on)

4. `npm login` (or confirm `npm whoami`).
5. First publish of an unscoped public package:
   ```
   npm publish
   ```
   (If you ever scope it as `@something/safeseed`, you'd need `npm publish --access public`. Unscoped `safeseed` defaults to public.)
6. Approve the 2FA / OTP prompt.
7. Verify it's live:
   ```
   npm view safeseed
   npx safeseed@latest --help
   ```

## Post-publish (nice-to-have follow-ups)

- Tag the release in git: `git tag v0.2.0 && git push --tags`, then cut a GitHub Release.
- The `verify` GitHub Action (`action.yml`) can get its own Marketplace listing — separate step, see the SPEC's "verify GitHub Action" capability.
- Add an npm version + license badge to the README header.
- Provenance is already wired into the Release workflow (`--provenance`) — no extra step.

## Notes

- The `allowScripts` field (`esbuild@0.21.5`) is an allow-scripts/lavamoat allowlist, harmless to publish.
- Nothing here pushes or publishes automatically. Publishing is always your explicit `npm publish`.
