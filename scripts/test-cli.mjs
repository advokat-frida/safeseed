import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, "dist", "cli.js");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function expect(condition, message, result) {
  if (condition) return;
  process.stderr.write(`FAIL: ${message}\n`);
  if (result?.stdout) process.stderr.write(`stdout:\n${result.stdout}`);
  if (result?.stderr) process.stderr.write(`stderr:\n${result.stderr}`);
  process.exit(1);
}

const temp = mkdtempSync(join(tmpdir(), "safeseed-cli-"));
try {
  const hostileCsv = join(temp, "hostile.csv");
  const privateEmail = "real.person@gmail.com";
  const privatePhone = "(212) 867-5309";
  const injectedCommand = "::set-output name=injected::yes";
  writeFileSync(
    hostileCsv,
    `email,phone\n"${privateEmail}\n${injectedCommand}","${privatePhone} / (800) 555-0100"\n`,
  );

  const scan = run(["scan", "--in", hostileCsv, "--fields", "email:email,phone:phone"]);
  const scanOutput = `${scan.stdout ?? ""}${scan.stderr ?? ""}`;
  expect(scan.status === 1, "hostile scan must fail", scan);
  expect(!scanOutput.includes(privateEmail), "scan diagnostics leaked a candidate email", scan);
  expect(!scanOutput.includes(privatePhone), "scan diagnostics leaked a candidate phone", scan);
  expect(!scanOutput.includes(injectedCommand), "scan diagnostics emitted a workflow command", scan);
  expect(scanOutput.includes("candidate value redacted"), "scan diagnostics do not state redaction", scan);
  process.stdout.write("PASS: CLI scan redacts candidate values and control text\n");

  const config = join(temp, "duplicate.json");
  const dataOut = join(temp, "partial.csv");
  const recordOut = join(temp, "partial.record.json");
  writeFileSync(
    config,
    JSON.stringify({
      schema: [
        { name: "email", type: "email" },
        { name: "email", type: "phone" },
      ],
      rows: 2,
      seed: 1,
    }),
  );
  const duplicate = run([
    "generate",
    "--config",
    config,
    "--out",
    dataOut,
    "--record",
    recordOut,
  ]);
  expect(duplicate.status === 2, "duplicate schema must be rejected", duplicate);
  expect(!existsSync(dataOut) && !existsSync(recordOut), "invalid generation left a partial output", duplicate);
  process.stdout.write("PASS: CLI rejects duplicate schemas before writing output\n");

  const hostileHeaderConfig = join(temp, "hostile-header.json");
  const hostileHeader = "safe\n::add-mask::secret\nfield";
  writeFileSync(
    hostileHeaderConfig,
    JSON.stringify({
      schema: [{ name: hostileHeader, type: "email" }],
      rows: 1,
      seed: 1,
    }),
  );
  const hostileGenerate = run(["generate", "--config", hostileHeaderConfig]);
  const hostileGenerateOutput = `${hostileGenerate.stdout ?? ""}${hostileGenerate.stderr ?? ""}`;
  expect(hostileGenerate.status === 2, "control-bearing generated header must be rejected", hostileGenerate);
  expect(!hostileGenerateOutput.includes("::add-mask::secret"), "hostile generated header reached CLI output", hostileGenerate);

  const scanConfig = join(temp, "hostile-scan.json");
  writeFileSync(scanConfig, JSON.stringify({ columns: [{ name: hostileHeader, type: "email" }] }));
  const hostileScanConfig = run(["scan", "--config", scanConfig, "--in", hostileCsv]);
  const hostileScanConfigOutput = `${hostileScanConfig.stdout ?? ""}${hostileScanConfig.stderr ?? ""}`;
  expect(hostileScanConfig.status === 2, "control-bearing scan column must be rejected", hostileScanConfig);
  expect(!hostileScanConfigOutput.includes("::add-mask::secret"), "hostile scan column reached CLI output", hostileScanConfig);
  process.stdout.write("PASS: CLI rejects control-bearing generate and scan schemas\n");

  const formulaHeaderConfig = join(temp, "formula-header.json");
  const formulaDataOut = join(temp, "formula.csv");
  const formulaRecordOut = join(temp, "formula.record.json");
  writeFileSync(
    formulaHeaderConfig,
    JSON.stringify({
      schema: [{ name: '=HYPERLINK("https://example.com")', type: "email" }],
      rows: 1,
      seed: 1,
    }),
  );
  const formulaGenerate = run([
    "generate",
    "--config",
    formulaHeaderConfig,
    "--out",
    formulaDataOut,
    "--record",
    formulaRecordOut,
  ]);
  expect(formulaGenerate.status === 2, "spreadsheet-formula header must be rejected", formulaGenerate);
  expect(
    !existsSync(formulaDataOut) && !existsSync(formulaRecordOut),
    "formula-header rejection left a partial output",
    formulaGenerate,
  );
  process.stdout.write("PASS: CLI rejects spreadsheet-formula headers before writing output\n");

  const presetData = join(temp, "marketing.csv");
  const presetRecord = join(temp, "marketing.record.json");
  const presetGenerate = run([
    "generate",
    "--preset",
    "marketing-attribution",
    "--rows",
    "3",
    "--seed",
    "9",
    "--out",
    presetData,
    "--record",
    presetRecord,
  ]);
  expect(presetGenerate.status === 0, "marketing preset generation must succeed", presetGenerate);
  const presetCsv = readFileSync(presetData, "utf8");
  expect(
    presetCsv.startsWith("event_id,cookie_id,campaign_id,landing_page_url,email_sha256,phone_sha256\n"),
    "marketing preset emitted the wrong schema",
    presetGenerate,
  );
  const presetVerify = run(["verify", "--in", presetData, "--record", presetRecord]);
  expect(presetVerify.status === 0, "generated marketing preset must pass strict verify", presetVerify);
  const presets = run(["presets"]);
  expect(presets.status === 0 && presets.stdout.includes("uk-contacts"), "presets command must list schemas", presets);
  process.stdout.write("PASS: CLI preset generates and strictly verifies a practical schema\n");

  const malformedCsv = join(temp, "malformed.csv");
  writeFileSync(malformedCsv, 'email\n"user1@example.net');
  const malformedScan = run(["scan", "--in", malformedCsv, "--fields", "email:email"]);
  expect(malformedScan.status === 1, "malformed CSV scan must fail", malformedScan);
  expect(malformedScan.stdout.includes("[malformed-csv]"), "scan did not identify malformed CSV", malformedScan);
  expect(!malformedScan.stdout.includes("user1@example.net"), "malformed scan leaked cell content", malformedScan);

  const malformedVerify = run(["verify", "--in", malformedCsv, "--record", presetRecord]);
  expect(malformedVerify.status === 1, "malformed CSV verify must fail", malformedVerify);
  expect(malformedVerify.stdout.includes("[malformed-csv]"), "verify did not identify malformed CSV", malformedVerify);
  expect(!malformedVerify.stdout.includes("user1@example.net"), "malformed verify leaked cell content", malformedVerify);
  process.stdout.write("PASS: CLI scan and verify fail closed on malformed CSV syntax\n");
} finally {
  rmSync(temp, { recursive: true, force: true });
}

process.stdout.write("SafeSeed CLI boundary contract: 6/6 passed.\n");
