# SafeSeed npm + GitHub release

SafeSeed uses one exact semantic version for the npm package, Git tag, and stable GitHub Release.
Those are related surfaces, but they are not the same state. Verify each one separately.

## Current release boundary (2026-08-20)

- npm currently serves `safeseed@0.2.1`.
- Git contains `v0.2.0` and `v0.2.1` tags but no GitHub Releases.
- The `0.4.0` candidate exists only in the local working tree. It supersedes the unpublished
  `0.3.0` candidate and has not been committed, pushed,
  exercised by hosted CI, tagged, released, or published to npm.
- Publishing a stable GitHub Release triggers `.github/workflows/release.yml` and can publish to
  npm after the protected-environment approval. Publishing that Release is therefore a release
  action, not harmless bookkeeping.

Committing, pushing, tagging, publishing a GitHub Release, approving the npm environment, and
publishing to npm all require Ben's explicit approval.

## One-time protected setup

Do this only after the candidate workflow is reviewed and present on the default branch.

1. Enable **immutable releases** for `advokat-frida/safeseed`. The release workflow checks the
   published Release's immutable flag and refuses publication if that specific Release is mutable.
2. Create a GitHub environment named **`npm`**:
   - require at least one reviewer;
   - disallow administrator bypass;
   - allow deployment only from selected tags matching `v*`; and
   - do not store a registry token in the environment.
3. In the existing [`safeseed` package settings](https://www.npmjs.com/package/safeseed/access),
   configure one GitHub Actions trusted publisher with:
   - organization or user: `advokat-frida`;
   - repository: `safeseed`;
   - workflow filename: `release.yml`;
   - environment: `npm`; and
   - allowed action: `npm publish`.
4. Keep npm two-factor authentication enabled. After trusted publishing is proven, set package
   publishing access to **Require two-factor authentication and disallow tokens**, then revoke any
   obsolete automation publish token. The workflow must not use `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
5. Protect `main` with required status checks for `build-and-prove` and all three
   `Action contract (...)` matrix jobs. Dismiss stale approvals and require approval of the latest
   push. Keep ownership explicit in `.github/CODEOWNERS`; enable required code-owner review only
   after a second eligible reviewer exists, so a one-maintainer repository does not deadlock.
6. Add an active tag ruleset for `v*` that restricts tag creation, update, and deletion to the
   release maintainer. Immutable releases protect published tags; the ruleset protects the period
   before publication.
7. Enable secret scanning and push protection for the repository.
8. Confirm the CodeQL workflow has completed successfully on the final candidate commit and include
   its check in the protected `main` rules once the workflow exists on the default branch.

If there is only one maintainer, the environment approval is a deliberate final hold point rather
than independent separation of duties. Record that limitation instead of presenting it as a
second-person review.

## Candidate preflight

Record evidence in [`docs/release-readiness-v0.4.0.md`](docs/release-readiness-v0.4.0.md) and keep
its local-versus-hosted boundary accurate.

Run from the repository root on the exact candidate intended for review:

```powershell
npm.cmd ci
npm.cmd run release:check
npm.cmd pack --dry-run --json --ignore-scripts

npm.cmd ci --prefix demo
npm.cmd audit --prefix demo --audit-level=moderate
npm.cmd run build --prefix demo
npm.cmd run build:standalone:all --prefix demo

git status --porcelain --untracked-files=all -- dist
git diff --exit-code -- `
  demo/safeseed-demo.html `
  demo/safeseed-generator.html `
  demo/safeseed-proof.html `
  demo/safeseed-proof.js
```

The freshness check deliberately includes the legacy `safeseed-demo.html` showcase and standalone
`safeseed-proof.html` while they remain compatibility outputs. The current browser-facing products
are `safeseed-generator.html` and the `safeseed-proof.js` embed; rebuilding a legacy output does not
make it a current live surface or an approval target.

Confirm all of the following:

- 124 unit tests, the six-case CLI boundary contract, and the five-case local Action contract pass.
- Root and demo dependency audits report zero known vulnerabilities at moderate or higher severity.
- `dist/` is rebuilt and byte-clean. Those are the exact CLI bytes the Action runs.
- Every public demo build compiles the root package first; never bypass the `:compiled` wrappers
  directly when preparing release artifacts.
- All four committed browser outputs rebuild without a diff; the generator and JavaScript embed are
  current, while the showcase and standalone proof HTML remain legacy compatibility outputs.
- The package dry run contains only `dist/**`, `README.md`, `LICENSE`, and `package.json`.
- `package.json` and the root lockfile contain no runtime dependencies, and a fresh disposable
  consumer can install the packed tarball, run the installed CLI, and complete an API
  generate-to-verify round trip without fetching a runtime dependency tree.
- `package.json`, `package-lock.json`, `SAFESEED_VERSION`, the example run record, README Action tag,
  and top changelog entry all say `0.4.0`.
- The reserved-range catalog and its cited authority policies have been reviewed for this version;
  every public claim matches the field's actual assurance tier.
- The complete diff, including generated bytes and release workflow, has been reviewed.
- CodeQL reports no unresolved high-severity alert for the candidate.

## Hosted candidate proof, before any public release

After the reviewed candidate is committed and pushed to `main` with explicit approval:

1. Require a successful hosted CI run for that exact commit. It must include the real `uses: ./`
   Action contract on Ubuntu, Windows, and macOS. Local wrapper tests do not substitute for this.
2. Create a disposable public consumer repository with no secrets and minimum workflow
   permissions. Reference the SafeSeed candidate by its **full 40-character commit SHA**, not a
   tag.
3. Prove in hosted runs that:
   - the clean fixture passes;
   - an edited value fails;
   - an added column fails; and
   - passing the retired `allow-added-columns: "true"` input cannot relax the Action.
4. Record the candidate SHA, workflow URLs, conclusions, and consumer workflow source in the
   readiness receipt. Keep the repository until the release is verified.

This consumer proof happens before publication. A public release is not the experiment.

## Publish `0.4.0`

Only after every setup, local, hosted, and consumer gate above is complete:

1. Draft a GitHub Release titled `SafeSeed 0.4.0`, targeting the exact reviewed commit on `main`
   and tag `v0.4.0`.
2. Use the `0.4.0` changelog entry as release notes. Attach every intended asset before
   publication; immutable release assets cannot be edited afterward.
3. Re-read the target commit SHA, tag, hosted CI links, consumer proof, and immutable-release
   setting. Then publish the stable Release.
4. The `Release` workflow must verify the tag/version match, tag-to-event SHA, ancestry on `main`,
   immutable-release setting, and successful hosted CI for the exact SHA before it builds, tests,
   packs, hashes, and preserves the exact npm tarball as an immutable workflow artifact.
5. When the job waits on the `npm` environment, the reviewer checks the same evidence and then
   explicitly approves or rejects publication.
6. The protected job downloads that tarball, verifies its expected filename and SHA-256, and
   publishes it with npm's short-lived OIDC exchange and provenance. It must not install
   dependencies or execute package lifecycle scripts while the OIDC permission is available.

Read the registry back after the workflow succeeds:

```powershell
npm.cmd view safeseed@0.4.0 version dist.integrity dist.shasum --json
npx.cmd --yes safeseed@0.4.0 version
```

The expected CLI line begins `safeseed 0.4.0`. Confirm npm shows provenance and that the package,
tag, Release, source commit, and Action logs all resolve to the intended version.

## Failure handling

- Never move or overwrite a published release tag. If published contents are wrong, fix forward as
  `0.4.1`.
- If the Release exists but the environment approval is rejected, leave npm unpublished while the
  issue is assessed. Do not bypass the environment.
- If npm publication fails before the package exists, diagnose the workflow. If tagged contents
  must change, create a new version; do not force-push or reuse the tag.
- A local build, pushed commit, hosted CI run, consumer proof, GitHub Release, and npm publication
  are distinct facts. Report them separately.
