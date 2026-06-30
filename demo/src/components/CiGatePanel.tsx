import { useState } from "react";

// A complete, copy-pasteable workflow. Pinned to v0.2.0 because that tag actually
// resolves on the public repo (there is no moving v0 tag yet).
const WORKFLOW = `# .github/workflows/safeseed.yml
name: data check
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: tanjaminben/safeseed@v0.2.0
        with:
          data: fixtures/seed.csv
          record: fixtures/seed.record.json`;

// The capstone under the proof: the same verify check, shown as a CI gate. A toggle flips a
// mock pull-request check between pass (exit 0, mergeable) and fail (exit 1, merge blocked),
// so the reader sees the operational payoff — not another data table.
export default function CiGatePanel() {
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      ?.writeText(WORKFLOW)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };

  return (
    <section className="ci-gate" aria-label="Wire it into CI/CD">
      <div className="ci-head">
        <h3>Wire it into CI/CD</h3>
        <p className="step-help">
          The same verify check, as a build step. In a pull request, a fixture that drifts out of range or was edited
          fails the build <strong>before it can merge</strong> — so real data never reaches your test environment.
        </p>
      </div>

      <div className="ci-toggle">
        <span className="ci-toggle-label">This pull request adds a fixture that is:</span>
        <div className="seg" role="group" aria-label="What the pull request contains">
          <button className={`seg-btn ${!edited ? "active" : ""}`} aria-pressed={!edited} onClick={() => setEdited(false)}>
            Safe, as generated
          </button>
          <button className={`seg-btn ${edited ? "active" : ""}`} aria-pressed={edited} onClick={() => setEdited(true)}>
            Edited with real data
          </button>
        </div>
      </div>

      <div className={`ci-checks ${edited ? "fail" : "pass"}`} role="status" aria-live="polite">
        <div className="ci-check-row">
          <span className="ci-check-icon" aria-hidden="true">{edited ? "✗" : "✓"}</span>
          <span className="ci-check-name">SafeSeed Verify</span>
          <span className="ci-check-state">{edited ? "Failed" : "Passed"}</span>
          <span className="ci-check-exit">exit {edited ? 1 : 0}</span>
        </div>
        <div className="ci-merge">
          <span className="ci-merge-icon" aria-hidden="true">{edited ? "✗" : "✓"}</span>
          <span className="ci-merge-text">
            {edited ? "Merge blocked — 1 check failed" : "All checks passed — ready to merge"}
          </span>
        </div>
        <p className="ci-check-note">
          {edited
            ? "verify caught a real value the verification file never attested. The build stops here; the pull request can't merge until the fixture is clean again."
            : "Every value is still in its reserved range and the file matches its record, so the build is green."}
        </p>
      </div>

      <div className="code-block ci-code">
        <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copy} aria-label="Copy the workflow">
          {copied ? "copied" : "copy"}
        </button>
        <pre className="code">{WORKFLOW}</pre>
      </div>
      <p className="ci-fine">
        Runs on every push. No install — <code>npx</code> pulls SafeSeed from npm at run time. This exact gate is already
        green on the SafeSeed repo itself.
      </p>
    </section>
  );
}
