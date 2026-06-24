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
  "designated-test-only": "Designated test-only",
  "structurally-fake": "Structurally fake",
};

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

  // Run record binds the content hash (async via Web Crypto).
  useEffect(() => {
    let live = true;
    makeRunRecord(ds, csv).then((r) => {
      if (live) setRecord(r);
    });
    return () => {
      live = false;
    };
  }, [ds, csv]);

  // The tampered file the verifier actually checks.
  const tamperedCsv = useMemo(() => {
    if (tamper === "none") return csv;
    const rows = ds.rows.map((r) => [...r]);
    const ipIdx = SCHEMA.findIndex((f) => f.type === "ipv4");
    const cardIdx = SCHEMA.findIndex((f) => f.type === "creditCard");
    if (tamper === "outrange" && rows[1]) {
      rows[1][ipIdx] = "8.8.8.8"; // a real, routable public IP — outside RFC 5737
    }
    if (tamper === "inrange" && rows[1]) {
      const cur = rows[1][cardIdx];
      rows[1][cardIdx] = cur === "4242424242424242" ? "4111111111111111" : "4242424242424242";
    }
    return toCsv(ds.columns, rows);
  }, [tamper, ds, csv]);

  useEffect(() => {
    if (!record) return;
    let live = true;
    verify(tamperedCsv, record).then((r) => {
      if (live) setVerifyResult(r);
    });
    return () => {
      live = false;
    };
  }, [tamperedCsv, record]);

  return (
    <section className="proof" aria-label="Interactive proof">
      <div className="proof-head">
        <h2>See it for yourself</h2>
        <p>
          Every step below runs locally and instantly. Nothing is sent anywhere — generate the data, read its receipt,
          try to slip something real past the verifier, then scan a file that looks clean.
        </p>
      </div>

      {/* STEP 1 — GENERATE */}
      <div className="step">
        <div className="step-head">
          <span className="step-n">1</span>
          <h3>Generate</h3>
          <div className="seed-ctl">
            <label htmlFor="seed">seed</label>
            <input
              id="seed"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
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
          <p className="determinism">
            Same seed always produces the same rows, so a generated fixture is committable and reviewable. Change the
            seed and the data changes; set it back and it returns byte-for-byte.
          </p>
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
          <span className="step-sub">the tamper-evident receipt</span>
        </div>
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
          <span className="step-sub">two independent checks, fails closed</span>
        </div>
        <div className="tamper-ctl">
          <span id="tamper-label">Try to slip something past it:</span>
          <div className="seg" role="group" aria-labelledby="tamper-label">
            <button
              className={`seg-btn ${tamper === "none" ? "active" : ""}`}
              aria-pressed={tamper === "none"}
              onClick={() => setTamper("none")}
            >
              Untouched
            </button>
            <button
              className={`seg-btn ${tamper === "inrange" ? "active" : ""}`}
              aria-pressed={tamper === "inrange"}
              onClick={() => setTamper("inrange")}
            >
              Edit one cell (still in range)
            </button>
            <button
              className={`seg-btn ${tamper === "outrange" ? "active" : ""}`}
              aria-pressed={tamper === "outrange"}
              onClick={() => setTamper("outrange")}
            >
              Slip in a real IP (8.8.8.8)
            </button>
          </div>
        </div>
        {verifyResult && (
          <div className={`verify-result ${verifyResult.ok ? "pass" : "fail"}`} role="status" aria-live="polite">
            <div className="verify-status">{verifyResult.ok ? "VERIFY: PASS" : "VERIFY: FAIL"}</div>
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
            <p className="verify-note">
              Verification fails closed. The content hash and the range check are independent — an in-range edit still
              breaks the hash; a recomputed hash still can't pass an out-of-range value.
            </p>
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
        <span className="step-sub">find real PII already sitting in a test file</span>
      </div>
      <p className="scan-intro">
        Paste an existing CSV. Scan flags every value that is <em>not</em> in a reserved range as candidate real PII.
        This is what a generator alone can't do — it works on data you already have.
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
              <span className="scan-clean">clean — {result.scannedRows} rows, no candidate PII</span>
            ) : (
              <span className="scan-dirty">
                {result.findings.length} candidate{result.findings.length === 1 ? "" : "s"} across{" "}
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
                        {isFlagged && <span className="flag-tag">candidate real PII</span>}
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
