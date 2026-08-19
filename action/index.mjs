import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ACTION_TITLE = "SafeSeed Verify";

function escapeWorkflowData(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function annotation(message) {
  process.stderr.write(`::error title=${ACTION_TITLE}::${escapeWorkflowData(message)}\n`);
}

function input(name, { required = false } = {}) {
  const key = `INPUT_${name.toUpperCase()}`;
  const value = (process.env[key] ?? "").trim();
  if (required && value === "") {
    annotation(`Missing required input: ${name}`);
    process.exit(2);
  }
  return value;
}

const data = input("data", { required: true });
const record = input("record", { required: true });

const actionDir = dirname(fileURLToPath(import.meta.url));
const cli = resolve(actionDir, "..", "dist", "cli.js");
const args = [cli, "verify", "--in", data, "--record", record];

// No shell is involved: every workflow input remains an argv value, so paths
// containing command syntax are data rather than executable text.
// The verifier reports values and record metadata supplied by the caller. GitHub
// runners interpret `::...::` lines on stdout as workflow commands, so inherited
// child output must be quarantined. The fresh token stays in this wrapper (it is
// never added to the child environment), and `finally` restores wrapper commands
// before any controlled annotation is emitted.
const stopToken = `safeseed-${randomUUID()}`;
let result;
writeSync(1, `::stop-commands::${stopToken}\n`);
try {
  result = spawnSync(process.execPath, args, {
    cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
    env: process.env,
    stdio: "inherit",
    timeout: 5 * 60 * 1000,
    windowsHide: true,
  });
} finally {
  writeSync(1, `::${stopToken}::\n`);
}

if (result.error) {
  annotation(`Unable to start SafeSeed: ${result.error.message}`);
  process.exit(2);
}
if (result.signal) {
  annotation(`SafeSeed was terminated by ${result.signal}.`);
  process.exit(2);
}

process.exit(result.status ?? 2);
