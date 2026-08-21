import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Git may materialize workflow files with CRLF on Windows. Normalize only the
// in-memory inspection text so release-policy checks behave the same on every CI
// and maintainer platform; package and fixture byte checks remain untouched.
const read = (path) => readFileSync(resolve(root, path), "utf8").replaceAll("\r\n", "\n");
const json = (path) => JSON.parse(read(path));
const failures = [];
const outOfScopeListingTerm = ["market", "place"].join("");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const pkg = json("package.json");
const lock = json("package-lock.json");
const demoPkg = json("demo/package.json");
const record = json("examples/customers.record.json");
const action = read("action.yml");
const actionWrapper = read("action/index.mjs");
const readme = read("README.md");
const changelog = read("CHANGELOG.md");
const publishChecklist = read("PUBLISH-CHECKLIST.md");
const readinessReceipt = read("docs/release-readiness-v0.4.0.md");
const gitAttributes = read(".gitattributes");
const ciWorkflow = read(".github/workflows/ci.yml");
const codeqlWorkflow = read(".github/workflows/codeql.yml");
const releaseWorkflow = read(".github/workflows/release.yml");
const publishJob = releaseWorkflow.slice(releaseWorkflow.indexOf("\n  publish:\n"));
const sourceVersion = read("src/record.ts").match(/SAFESEED_VERSION\s*=\s*"([^"]+)"/)?.[1];
const firstChangelogVersion = changelog.match(/^##\s+([^\s]+)\s+/m)?.[1];

assert(pkg.version === lock.version, "package.json and package-lock.json versions differ");
assert(
  demoPkg.scripts?.["build:core"] === "npm run build --prefix ..",
  "demo build no longer compiles the package core before bundling",
);
for (const scriptName of [
  "build",
  "build:standalone",
  "build:standalone:generator",
  "build:standalone:proof",
  "build:standalone:embed",
  "build:standalone:all",
]) {
  assert(
    demoPkg.scripts?.[scriptName]?.startsWith("npm run build:core && "),
    `demo ${scriptName} can bundle a stale package dist/`,
  );
}
assert(
  pkg.dependencies === undefined || Object.keys(pkg.dependencies).length === 0,
  "package manifest declares runtime dependencies despite the zero-runtime-dependency contract",
);
assert(
  lock.packages?.[""]?.dependencies === undefined ||
    Object.keys(lock.packages[""].dependencies).length === 0,
  "root lockfile declares runtime dependencies despite the zero-runtime-dependency contract",
);
assert(pkg.engines?.node === ">=22", "package engine floor is not the supported Node >=22 contract");
assert(pkg.version === lock.packages?.[""]?.version, "root lockfile package version differs");
assert(pkg.version === sourceVersion, "package.json and SAFESEED_VERSION differ");
assert(pkg.version === record.safeseedVersion, "example run record has a stale SafeSeed version");
assert(pkg.version === firstChangelogVersion, "the newest changelog entry is not this package version");
assert(readme.includes(`advokat-frida/safeseed@v${pkg.version}`), "README Action example has a stale release tag");
assert(action.includes('using: "node24"'), "Action is not pinned to GitHub's Node 24 runtime");
assert(action.includes('main: "action/index.mjs"'), "Action entry point is not the committed wrapper");
assert(!/\bnpx\b/.test(action), "Action metadata still invokes npx");
assert(!/\blatest\b/.test(action), "Action metadata still references a mutable latest version");
assert(!/^\s{2}version:/m.test(action), "Action still exposes the removed npm version override");
assert(!/allow-added-columns/.test(action), "Action metadata exposes partial column-scoped verification");
assert(!/allow-added-columns/.test(actionWrapper), "Action wrapper can still enable partial verification");
assert(actionWrapper.includes('const args = [cli, "verify", "--in", data, "--record", record]'), "Action wrapper is not an explicit strict verify invocation");
assert(actionWrapper.includes("randomUUID()"), "Action output quarantine does not use a per-run random token");
assert(actionWrapper.includes("::stop-commands::"), "Action output is not protected by a stop-commands envelope");
assert(actionWrapper.includes("finally"), "Action wrapper does not restore workflow commands in a finally block");
assert(existsSync(resolve(root, "dist", "cli.js")), "committed dist/cli.js is missing");
assert(/^\*\.csv\s+text\s+eol=lf\s*$/m.test(gitAttributes), "tracked CSV bytes are not pinned to LF across operating systems");

for (const [name, workflow] of [
  ["CI", ciWorkflow],
  ["CodeQL", codeqlWorkflow],
  ["release", releaseWorkflow],
]) {
  const externalActions = [...workflow.matchAll(/^\s*-\s+uses:\s+([^@\s]+)@([^\s#]+)/gm)];
  assert(externalActions.length > 0, `${name} workflow has no external Action pins to inspect`);
  for (const [, actionName, ref] of externalActions) {
    assert(/^[0-9a-f]{40}$/.test(ref), `${name} workflow does not pin ${actionName} to a full commit SHA`);
  }
}

for (const os of ["ubuntu-latest", "windows-latest", "macos-latest"]) {
  assert(ciWorkflow.includes(os), `CI Action contract is missing ${os}`);
}
assert((ciWorkflow.match(/uses:\s+\.\//g) ?? []).length >= 3, "CI does not exercise the strict bundled Action contract");
assert(/node-version:\s*22\b/.test(ciWorkflow), "core CI does not exercise the minimum supported Node 22 runtime");
assert(/npm pack --dry-run --json --ignore-scripts\b/.test(ciWorkflow), "CI package inspection can execute package lifecycle scripts");

assert(/\n\s*release:\s*\n\s*types:\s*\[published\]/.test(releaseWorkflow), "release workflow is not triggered by a published GitHub Release");
assert(!/\n\s*push:\s*\n\s*tags:/.test(releaseWorkflow), "release workflow still publishes on a raw tag push");
assert(releaseWorkflow.includes("github.event.release.prerelease == false"), "release workflow does not reject prereleases");
assert(releaseWorkflow.includes("actions: read"), "release workflow cannot inspect hosted CI results");
assert(releaseWorkflow.includes("id-token: write"), "release workflow cannot request an npm OIDC token");
assert(/environment:\s*npm\b/.test(releaseWorkflow), "release workflow is not protected by the npm environment");
assert(releaseWorkflow.includes("group: safeseed-npm-release"), "release workflow can race another version publication");
assert(/node-version:\s*24\b/.test(releaseWorkflow), "release workflow does not use Node 24 for trusted publishing");
assert(releaseWorkflow.includes("package-manager-cache: false"), "release workflow does not disable dependency caching");
assert(releaseWorkflow.includes("merge-base --is-ancestor"), "release workflow does not require the release commit to be on main");
assert(releaseWorkflow.includes("github.event.release.immutable"), "release workflow does not require an immutable GitHub Release");
assert(releaseWorkflow.includes("actions/workflows/ci.yml/runs"), "release workflow does not require successful hosted CI for the exact commit");
assert(releaseWorkflow.includes("actions/upload-artifact@"), "release workflow does not preserve the verified package as a workflow artifact");
assert(releaseWorkflow.includes("actions/download-artifact@"), "release workflow does not hand the verified package to the protected job");
assert(releaseWorkflow.includes("package-sha256"), "release workflow does not bind the downloaded tarball to its verified SHA-256");
assert(releaseWorkflow.includes("artifact-digest"), "release workflow does not require the immutable artifact digest");
assert(releaseWorkflow.includes("git status --porcelain --untracked-files=all"), "release workflow does not require a clean verified source tree before packing");
assert(/npm pack --json --ignore-scripts\b/.test(releaseWorkflow), "release workflow pack step can execute package lifecycle scripts");
assert(!/\bnpm ci\b/.test(publishJob), "protected publish job still installs dependencies while OIDC is available");
assert(!/\bnpm run\b/.test(publishJob), "protected publish job still executes package scripts while OIDC is available");
assert(/npm publish [^\n]+--access public --ignore-scripts\b/.test(publishJob), "release workflow publish command is not script-disabled");
assert(!/NPM_TOKEN|NODE_AUTH_TOKEN/.test(releaseWorkflow), "release workflow still references a long-lived npm token");

for (const [name, surface] of [
  ["Action metadata", action],
  ["README", readme],
  ["publish checklist", publishChecklist],
  ["release-readiness receipt", readinessReceipt],
  ["release workflow", releaseWorkflow],
]) {
  assert(
    !new RegExp(outOfScopeListingTerm, "i").test(surface),
    `${name} still contains out-of-scope public-listing material`,
  );
}

if (process.argv.includes("--require-clean-dist")) {
  const distStatus = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", "dist"],
    { cwd: root, encoding: "utf8" },
  ).trim();
  assert(distStatus === "", "dist/ is untracked or differs from the committed Action bytes");
}

if (failures.length === 0) {
  const versionOutput = execFileSync(process.execPath, [resolve(root, "dist", "cli.js"), "version"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  assert(versionOutput.startsWith(`safeseed ${pkg.version} `), "compiled CLI reports a stale version");
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`FAIL: ${failure}\n`);
  process.exit(1);
}

process.stdout.write(`Release alignment: SafeSeed ${pkg.version} is internally consistent.\n`);
