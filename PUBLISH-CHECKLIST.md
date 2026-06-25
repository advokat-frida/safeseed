# Publishing SafeSeed to npm

The package is shaped and ready; the only thing that requires you is the npm login + the publish itself (your account + 2FA). This is the checklist for that moment.

## Status (as of 2026-06-24)

- **Name `safeseed` is available** on npm (registry returns 404 — not taken).
- `package.json` is publish-shaped: `main`, `types`, `bin` (`safeseed` → `dist/cli.js`), `exports`, and a `files` allowlist (`dist`, `README.md`, `LICENSE`) are all set.
- `prepublishOnly: "npm run build"` is wired, so `dist/` is rebuilt fresh on every publish — you can't accidentally ship a stale build.
- `repository` / `homepage` / `bugs` metadata added so the npm page links back to the repo.
- Current version: **0.2.0**.

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

## Publish (needs your npm account + 2FA — your action, not mine)

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
- Consider `npm publish --provenance` from CI later for supply-chain attestation (needs a CI publish workflow + npm trusted publishing).

## Notes

- The `allowScripts` field (`esbuild@0.21.5`) is an allow-scripts/lavamoat allowlist, harmless to publish.
- Nothing here pushes or publishes automatically. Publishing is always your explicit `npm publish`.
