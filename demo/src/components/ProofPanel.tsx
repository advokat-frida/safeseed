import { useEffect, useMemo, useState } from "react";
import {
  generate,
  toCsv,
  parseCsv,
  makeRunRecord,
  verify,
  scan,
  getEntry,
  type FieldSchema,
  type FieldType,
  type RunRecord,
  type VerifyResult,
  type ScanResult,
  type ScanColumn,
  type Tier,
} from "safeseed";
import { CITATIONS } from "../citations";

const SCHEMA: FieldSchema[] = [
  { name: "email", type: "email" },
  { name: "full_name", type: "fullName" },
  { name: "phone", type: "phone" },
  { name: "ssn", type: "ssn" },
  { name: "card", type: "creditCard" },
  { name: "ip", type: "ipv4" },
];

const ROWS = 5;

const TIER_CLASS: Record<Tier, string> = {
  "provably-non-real": "tier-provable",
  "designated-test-only": "tier-designated",
  "structurally-fake": "tier-fake",
};

const TIER_LABEL: Record<Tier, string> = {
  "provably-non-real": "Provably non-real",
  "designated-test-only": "Designated for testing",
  "structurally-fake": "Structurally fake",
};

const SEED_HELP =
  "A seed is just a starting number. The same seed always produces the exact same rows, so the data is repeatable — save it as a test fixture and it regenerates identically, character for character, every time.";

/** A small "?" affordance that reveals an explanatory bubble on hover/focus. */
function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0} role="note" aria-label={text}>
      ?<span className="help-bubble" role="tooltip">{text}</span>
    </span>
  );
}

type Tamper = "none" | "inrange" | "outrange";

export default function ProofPanel() {
  const [seed, setSeed] = useState(1337);
  const [tamper, setTamper] = useState<Tamper>("none");
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [activeCite, setActiveCite] = useState<FieldType | null>(null);

  // Deterministic: output is a pure function of (schema, seed).
  const { ds, csv } = useMemo(() => {
    const dataset = generate({ schema: SCHEMA, rows: ROWS, seed });
    return { ds: dataset, csv: toCsv(dataset.columns, dataset.rows) };
  }, [seed]);

  // Run record binds the content hash (async via Web Crypto). While it recomputes for a new
  // seed, clear the old record + verdict first, so the verifier never runs the new data against
  // the stale record — which would flash a phantom VERIFY: FAIL before the new hash resolves.
  useEffect(() => {
    let live = true;
    setRecord(null);
    setVerifyResult(null);
    makeRunRecord(ds, csv).then((r) => {
      if (live) setRecord(r);
    });
    return () => {
      live = false;
    };
  }, [ds, csv]);

  // Single source of truth for step 3: the tampered rows, which cell changed (+ its old
  // value), the CSV the verifier checks, and a plain-language note. The table shown and the
  // bytes verified are derived from the SAME rows, so they can never disagree.
  const tampered = useMemo(() => {
    const rows = ds.rows.map((r) => [...r]);
    const ipIdx = SCHEMA.findIndex((f) => f.type === "ipv4");
    const cardIdx = SCHEMA.findIndex((f) => f.type === "creditCard");
    let changed: { row: number; col: number; before: string } | null = null;
    let note = "";
    if (tamper === "outrange" && rows[1]) {
      changed = { row: 1, col: ipIdx, before: rows[1][ipIdx]! };
      rows[1][ipIdx] = "8.8.8.8"; // a real, routable public IP — outside RFC 5737
      note = "Row 2's IP is now a real, routable address — outside every reserved range.";
    } else if (tamper === "inrange" && rows[1]) {
      const cur = rows[1][cardIdx]!;
      changed = { row: 1, col: cardIdx, before: cur };
      rows[1][cardIdx] = cur === "4242424242424242" ? "4111111111111111" : "4242424242424242";
      note = "Row 2's card is still a valid test card — but not the one the receipt fingerprinted.";
    }
    return { rows, changed, csv: toCsv(ds.columns, rows), note };
  }, [tamper, ds]);

  useEffect(() => {
    if (!record) return;
    let live = true;
    verify(tampered.csv, record).then((r) => {
      if (live) setVerifyResult(r);
    });
    return () => {
      live = false;
    };
  }, [tampered, record]);

  return (
    <section className="proof" id="proof" aria-label="Interactive proof">
      <div className="proof-head">
        <h2>See it for yourself</h2>
        <p>
          Every step below runs locally and instantly. Nothing is sent anywhere — generate the data, read its receipt,
          try to slip something real past the verifier, then scan a file that looks clean.
        </p>
        <div className="tier-legend" aria-hidden="true">
          <span className="tier-legend-item">
            <span className="cite-dot tier-provable" /> provably non-real
          </span>
          <span className="tier-legend-item">
            <span className="cite-dot tier-designated" /> designated for testing
          </span>
          <span className="tier-legend-item">
            <span className="cite-dot tier-fake" /> structurally fake
          </span>
        </div>
      </div>

      {/* STEP 1 — GENERATE */}
      <div className="step">
        <div className="step-head">
          <span className="step-n">1</span>
          <h3>Generate</h3>
          <div className="seed-ctl">
            <label htmlFor="seed">seed</label>
            <HelpTip text={SEED_HELP} />
            <input
              id="seed"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              title="A starting number. The same seed always generates the exact same data."
              value={seed}
              onChange={(e) => {
                setTamper("none");
                const n = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(n)) setSeed(n);
              }}
            />
            <button className="btn btn-ghost" onClick={() => { setTamper("none"); setSeed((s) => s + 1); }}>
              ↻ new seed
            </button>
          </div>
        </div>

        <div className="exhibit">
          <div className="exhibit-bar">
            <span className="exhibit-file">customers.synthetic.csv</span>
            <span className="exhibit-meta">
              seed {seed} · {ROWS} rows · every cell in a cited reserved range
            </span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {SCHEMA.map((f) => {
                    const tier = getEntry(f.type).tier;
                    const cite = CITATIONS[f.type];
                    return (
                      <th key={f.name}>
                        <span className="col-name">{f.name}</span>
                        <button
                          className={`cite-chip ${TIER_CLASS[tier]}`}
                          onClick={() => setActiveCite(activeCite === f.type ? null : f.type)}
                          aria-label={`${f.name}: ${TIER_LABEL[tier]}, cited by ${cite.short} — open citation`}
                          title={`${TIER_LABEL[tier]} — click for the citation`}
                        >
                          <span className="cite-dot" aria-hidden="true" />
                          {cite.short}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ds.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => {
                      const tier = getEntry(SCHEMA[c]!.type).tier;
                      return (
                        <td key={c} className={TIER_CLASS[tier]}>
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {activeCite && (
          <div className="cite-card">
            <button className="cite-close" onClick={() => setActiveCite(null)} aria-label="Close">
              ×
            </button>
            <div className="cite-card-tier">
              <span className={`cite-dot ${TIER_CLASS[getEntry(activeCite).tier]}`} />
              {TIER_LABEL[getEntry(activeCite).tier]}
            </div>
            <h4>{CITATIONS[activeCite].standard}</h4>
            <p>{CITATIONS[activeCite].reserves}</p>
            <p className="cite-core">Catalog citation: {getEntry(activeCite).citation}</p>
            {CITATIONS[activeCite].url && (
              <a href={CITATIONS[activeCite].url} target="_blank" rel="noreferrer">
                {CITATIONS[activeCite].url} ↗
              </a>
            )}
          </div>
        )}
      </div>

      {/* STEP 2 — RUN RECORD */}
      <div className="step">
        <div className="step-head">
          <span className="step-n">2</span>
          <h3>Run record</h3>
        </div>
        <p className="step-help">
          This tamper-evident receipt contains a <code>contentSha256</code> key, the fingerprint of the data — a code
          that changes completely if even one character is altered. Anyone can recompute it from the file and compare:
          the same fingerprint means the file is untouched, a different one means it was changed. That is how the next
          step catches tampering.
        </p>
        <pre className="record">
{record
  ? JSON.stringify(
      {
        safeseedVersion: record.safeseedVersion,
        catalogVersion: record.catalogVersion,
        seed: record.seed,
        rowCount: record.rowCount,
        contentSha256: record.contentSha256,
        fields: record.fields.map((f) => ({ name: f.name, tier: f.tier })),
      },
      null,
      2,
    )
  : "computing content hash…"}
        </pre>
      </div>

      {/* STEP 3 — VERIFY */}
      <div className="step">
        <div className="step-head">
          <span className="step-n">3</span>
          <h3>Verify</h3>
        </div>
        <p className="step-help">
          SafeSeed runs two independent re-checks whenever the generated file is edited, and the test only passes if
          both do.
        </p>
        <div className="tamper-ctl">
          <span id="tamper-label">Edit the file:</span>
          <div className="seg" role="group" aria-labelledby="tamper-label">
            <button
              className={`seg-btn ${tamper === "none" ? "active" : ""}`}
              aria-pressed={tamper === "none"}
              onClick={() => setTamper("none")}
            >
              Leave it untouched
            </button>
            <button
              className={`seg-btn ${tamper === "inrange" ? "active" : ""}`}
              aria-pressed={tamper === "inrange"}
              onClick={() => setTamper("inrange")}
            >
              Swap a card for another test card
            </button>
            <button
              className={`seg-btn ${tamper === "outrange" ? "active" : ""}`}
              aria-pressed={tamper === "outrange"}
              onClick={() => setTamper("outrange")}
            >
              Paste in a real IP
            </button>
          </div>
        </div>
        <div className="exhibit verify-exhibit">
          <div className="exhibit-bar">
            <span className="exhibit-file">customers.synthetic.csv</span>
            <span className="exhibit-meta">
              {tamper === "none" ? "the file from step 1 · untouched" : "the file from step 1 · 1 cell edited"}
            </span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {SCHEMA.map((f) => {
                    const tier = getEntry(f.type).tier;
                    const cite = CITATIONS[f.type];
                    return (
                      <th key={f.name}>
                        <span className="col-name">{f.name}</span>
                        <span className={`cite-chip is-static ${TIER_CLASS[tier]}`} title={TIER_LABEL[tier]}>
                          <span className="cite-dot" aria-hidden="true" />
                          {cite.short}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tampered.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => {
                      const tier = getEntry(SCHEMA[c]!.type).tier;
                      const isChanged = tampered.changed?.row === r && tampered.changed?.col === c;
                      return (
                        <td
                          key={isChanged ? `${c}-${tamper}` : c}
                          className={`${TIER_CLASS[tier]} ${isChanged ? "cell-changed" : ""}`}
                        >
                          {cell}
                          {isChanged && tampered.changed && (
                            <span className="cell-was">was {tampered.changed.before}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tampered.note && (
            <p className="verify-edit-note" role="status" aria-live="polite">
              {tampered.note}
            </p>
          )}
        </div>
        {verifyResult && (
          <div className={`verify-result ${verifyResult.ok ? "pass" : "fail"}`} role="status" aria-live="polite">
            <div className="verify-status">
              <span className="verify-icon" aria-hidden="true">{verifyResult.ok ? "✓" : "✗"}</span>
              {verifyResult.ok ? "VERIFY: PASS" : "VERIFY: FAIL"}
            </div>
            {verifyResult.ok ? (
              <ul>
                <li>content hash matches the recorded hash ✓</li>
                <li>every value is in its declared reserved range ✓</li>
              </ul>
            ) : (
              <ul>
                {verifyResult.failures.map((f, i) => (
                  <li key={i}>
                    <span className="fail-kind">[{f.kind}]</span> {f.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* STEP 4 — SCAN */}
      <ScanStep />
    </section>
  );
}

const SCAN_COLUMNS: ScanColumn[] = [
  { name: "email", type: "email" },
  { name: "phone", type: "phone" },
  { name: "ip", type: "ipv4" },
];

const DIRTY_CSV = [
  "email,phone,ip",
  "amir.haddad@example.com,(212) 555-0142,192.0.2.20",
  "jordan.lee@gmail.com,415-555-2671,8.8.8.8",
  "sam.rivera@example.org,(800) 555-0188,198.51.100.5",
].join("\n");

function ScanStep() {
  const [text, setText] = useState(DIRTY_CSV);
  const [result, setResult] = useState<ScanResult | null>(null);

  const parsed = useMemo(() => parseCsv(text), [text]);
  const flagged = useMemo(() => {
    const set = new Set<string>();
    if (result) for (const f of result.findings) set.add(`${f.row}:${f.field}`);
    return set;
  }, [result]);

  return (
    <div className="step">
      <div className="step-head">
        <span className="step-n">4</span>
        <h3>Scan</h3>
      </div>
      <p className="scan-intro">
        Find real PII already sitting in a test file by pointing the scanner at a document. For each typed column, the
        scan flags every value that is <em>not</em> in its reserved range as possible real PII. It is a tripwire for
        the field types you name — not a general PII discovery tool — and unlike a generator, it works on data you
        already have.
      </p>
      <div className="field">
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      </div>
      <div className="scan-actions">
        <button className="btn btn-primary" onClick={() => setResult(scan({ csv: text, columns: SCAN_COLUMNS }))}>
          Scan
        </button>
        <span className="scan-summary" role="status" aria-live="polite">
          {result &&
            (result.ok ? (
              <span className="scan-clean">clean — {result.scannedRows} rows, nothing flagged</span>
            ) : (
              <span className="scan-dirty">
                {result.findings.length} value{result.findings.length === 1 ? "" : "s"} flagged across{" "}
                {result.scannedRows} rows
              </span>
            ))}
        </span>
      </div>
      {result && (
        <div className="table-wrap">
          <table className="data scan-table">
            <thead>
              <tr>
                {parsed.columns.map((c) => (
                  <th key={c}>
                    <span className="col-name">{c}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => {
                    const colName = parsed.columns[c]!;
                    const isFlagged = flagged.has(`${r}:${colName}`);
                    return (
                      <td key={c} className={isFlagged ? "scan-flag" : ""}>
                        {cell}
                        {isFlagged && <span className="flag-tag">possible real PII</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
