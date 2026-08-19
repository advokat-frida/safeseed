import { dirname, resolve } from "node:path";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const action = resolve(root, "action", "index.mjs");

function runAction(inputs) {
  const env = { ...process.env, GITHUB_ACTIONS: "true", GITHUB_WORKSPACE: root };
  for (const [name, value] of Object.entries(inputs)) {
    env[`INPUT_${name.toUpperCase()}`] = value;
  }
  return spawnSync(process.execPath, [action], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

function expectStatus(name, expected, inputs) {
  const result = runAction(inputs);
  if (result.error) throw result.error;
  if (result.status !== expected) {
    process.stderr.write(`FAIL: ${name} exited ${result.status}; expected ${expected}.\n`);
    if (result.stdout) process.stderr.write(`stdout:\n${result.stdout}`);
    if (result.stderr) process.stderr.write(`stderr:\n${result.stderr}`);
    process.exit(1);
  }
  process.stdout.write(`PASS: ${name} (exit ${expected})\n`);
}

const base = {
  data: "examples/customers.csv",
  record: "examples/customers.record.json",
};

expectStatus("bundled Action accepts the clean fixture", 0, base);
expectStatus("bundled Action rejects strict column drift", 1, {
  ...base,
  data: "examples/customers-extended.csv",
});
expectStatus("legacy relaxed input cannot bypass the strict Action", 1, {
  ...base,
  data: "examples/customers-extended.csv",
  "allow-added-columns": "true",
});
expectStatus("bundled Action rejects a missing required input", 2, {
  data: base.data,
});

const hostileDir = mkdtempSync(join(tmpdir(), "safeseed-action-"));
try {
  const privateEmail = "real.person@gmail.com";
  const injectedCommand = "::set-output name=injected::yes";
  const cleanCsv = readFileSync(resolve(root, "examples", "customers.csv"), "utf8");
  const hostilePath = join(hostileDir, "hostile.csv");
  writeFileSync(
    hostilePath,
    cleanCsv.replace("user1@example.com", `"${privateEmail}\n${injectedCommand}"`),
  );

  const result = runAction({ ...base, data: hostilePath });
  if (result.error) throw result.error;
  if (result.status !== 1) {
    process.stderr.write(`FAIL: workflow-command injection fixture exited ${result.status}; expected 1.\n`);
    process.exit(1);
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const stop = output.match(/^::stop-commands::([^\r\n]+)$/m);
  if (!stop) {
    process.stderr.write("FAIL: untrusted verifier output is not wrapped in stop-commands.\n");
    process.exit(1);
  }
  const diagnosticAt = output.indexOf("value redacted");
  const resumedAt = output.indexOf(`::${stop[1]}::`);
  if (diagnosticAt < 0 || resumedAt < 0 || diagnosticAt < (stop.index ?? 0) || diagnosticAt > resumedAt) {
    process.stderr.write("FAIL: verifier diagnostics were not contained inside the quarantine envelope.\n");
    process.exit(1);
  }
  if (output.includes(privateEmail) || output.includes(injectedCommand)) {
    process.stderr.write("FAIL: Action output leaked a candidate value or raw workflow command.\n");
    process.exit(1);
  }
  process.stdout.write("PASS: verifier output is redacted and quarantined from workflow commands (exit 1)\n");
} finally {
  rmSync(hostileDir, { recursive: true, force: true });
}

process.stdout.write("SafeSeed Action contract: 5/5 passed.\n");
