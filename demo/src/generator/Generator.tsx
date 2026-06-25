import { useEffect, useMemo, useRef, useState } from "react";
import {
  generate,
  toCsv,
  makeRunRecord,
  CATALOG,
  getEntry,
  type FieldType,
  type Tier,
  type RunRecord,
} from "safeseed";
import { Plus, Trash2, Download, ArrowLeft, ShieldCheck } from "lucide-react";
import { getNetworkCount, subscribeNetworkCount } from "../netGuard";

const MAX_ROWS = 10000;
const PREVIEW_ROWS = 12;

const TIER_CLASS: Record<Tier, string> = {
  "provably-non-real": "tier-provable",
  "reserved-not-issued": "tier-reserved",
  "designated-test-only": "tier-designated",
  "structurally-fake": "tier-fake",
};
const TIER_LABEL: Record<Tier, string> = {
  "provably-non-real": "Provably non-real",
  "reserved-not-issued": "Reserved, never issued",
  "designated-test-only": "Designated for testing",
  "structurally-fake": "Structurally fake",
};

// Friendly labels for the type picker; falls back to the raw field type.
const FIELD_LABEL: Partial<Record<FieldType, string>> = {
  email: "Email",
  domain: "Domain",
  ipv4: "IPv4 address",
  ipv6: "IPv6 address",
  phone: "Phone",
  ssn: "US SSN",
  creditCard: "Credit card (test PAN)",
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  streetAddress: "Street address",
  freeText: "Free text",
};

const TYPE_OPTIONS = CATALOG.map((e) => ({
  value: e.field,
  label: FIELD_LABEL[e.field] ?? e.field,
  tier: e.tier,
}));

interface FieldRow {
  id: number;
  name: string;
  type: FieldType;
}

function download(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Generator() {
  const idRef = useRef(4);
  const [fields, setFields] = useState<FieldRow[]>([
    { id: 1, name: "email", type: "email" },
    { id: 2, name: "full_name", type: "fullName" },
    { id: 3, name: "phone", type: "phone" },
  ]);
  const [rowCount, setRowCount] = useState(100);
  const [seed, setSeed] = useState(1);

  const [netCount, setNetCount] = useState(getNetworkCount());
  useEffect(() => subscribeNetworkCount(() => setNetCount(getNetworkCount())), []);

  // Validation — names become CSV headers, so they must be present and unique.
  const trimmed = fields.map((f) => f.name.trim());
  const emptyName = trimmed.some((n) => n === "");
  const dupNames = trimmed.filter((n, i) => n !== "" && trimmed.indexOf(n) !== i);
  const rowsValid = Number.isInteger(rowCount) && rowCount >= 1 && rowCount <= MAX_ROWS;
  const seedValid = Number.isInteger(seed);
  const configValid = fields.length > 0 && !emptyName && dupNames.length === 0 && rowsValid && seedValid;

  const schema = useMemo(
    () => fields.map((f) => ({ name: f.name.trim(), type: f.type })),
    [fields],
  );
  const schemaKey = JSON.stringify(schema);

  const dataset = useMemo(
    () => (configValid ? generate({ schema, rows: rowCount, seed }) : null),
    // schemaKey captures the schema's value; schema itself is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemaKey, rowCount, seed, configValid],
  );

  const csv = useMemo(() => (dataset ? toCsv(dataset.columns, dataset.rows) : ""), [dataset]);

  const [record, setRecord] = useState<RunRecord | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!dataset) {
      setRecord(null);
      return;
    }
    void makeRunRecord(dataset, csv).then((r) => {
      if (!cancelled) setRecord(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dataset, csv]);

  const newId = () => idRef.current++;
  const updateField = (id: number, patch: Partial<FieldRow>) =>
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addField = () => {
    // Compute the id outside the updater so StrictMode's double-invoke can't double-bump it.
    const id = newId();
    setFields((fs) => [...fs, { id, name: `field_${fs.length + 1}`, type: "firstName" }]);
  };
  const removeField = (id: number) => setFields((fs) => fs.filter((f) => f.id !== id));

  const previewRows = dataset ? dataset.rows.slice(0, PREVIEW_ROWS) : [];
  const usedTiers = Array.from(new Set(fields.map((f) => getEntry(f.type).tier)));
  const canDownload = configValid && dataset !== null && record !== null;

  return (
    <div className="site">
      <p className="demo-banner">
        <strong>Demo — work in progress.</strong> Not for distribution or production use.
      </p>

      <header className="gen-top">
        <a className="gen-back" href="./index.html">
          <ArrowLeft size={14} aria-hidden="true" /> What SafeSeed is
        </a>
        <div className={`gen-net${netCount > 0 ? " tripped" : ""}`}>
          <span className="airgap-led" aria-hidden="true" />
          {netCount === 0 ? "0 network requests" : `${netCount} network request(s)`}
        </div>
      </header>

      <main className="site-main gen-main">
        <div className="gen-intro">
          <p className="eyebrow">Generator</p>
          <h1>Make confirmably-synthetic test data</h1>
          <p className="gen-lede">
            Pick your fields, set the row count and seed, preview, and download the data plus its run
            record. Every value is drawn from a standards-reserved range or built as a structurally
            fake token. It runs entirely in your browser — nothing leaves your device.
          </p>
        </div>

        <section className="gen-panel">
          <div className="gen-panel-head">
            <h2>Fields</h2>
            <span className="gen-hint">Column names become the CSV header.</span>
          </div>

          <div className="field-list">
            {fields.map((f) => {
              const tier = getEntry(f.type).tier;
              const isDup = f.name.trim() !== "" && dupNames.includes(f.name.trim());
              const isEmpty = f.name.trim() === "";
              return (
                <div className="field-row" key={f.id}>
                  <input
                    className={`field-name${isDup || isEmpty ? " invalid" : ""}`}
                    value={f.name}
                    spellCheck={false}
                    aria-label="Column name"
                    onChange={(e) => updateField(f.id, { name: e.target.value })}
                  />
                  <select
                    className="field-type"
                    value={f.type}
                    aria-label="Field type"
                    onChange={(e) => updateField(f.id, { type: e.target.value as FieldType })}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className={`tier-chip ${TIER_CLASS[tier]}`}>
                    <span className="tier-dot" aria-hidden="true" />
                    {TIER_LABEL[tier]}
                  </span>
                  <button
                    className="field-del"
                    aria-label={`Remove ${f.name || "field"}`}
                    disabled={fields.length === 1}
                    onClick={() => removeField(f.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          <button className="btn btn-ghost gen-add" onClick={addField}>
            <Plus size={15} aria-hidden="true" /> Add field
          </button>

          <div className="gen-nums">
            <label className="num-ctl">
              Rows
              <input
                type="number"
                min={1}
                max={MAX_ROWS}
                value={Number.isNaN(rowCount) ? "" : rowCount}
                onChange={(e) => setRowCount(Math.floor(Number(e.target.value)))}
              />
            </label>
            <label className="num-ctl">
              Seed
              <input
                type="number"
                value={Number.isNaN(seed) ? "" : seed}
                onChange={(e) => setSeed(Math.floor(Number(e.target.value)))}
              />
            </label>
            <span className="gen-hint seed-note">Same seed + fields → identical data, every time.</span>
          </div>

          {!configValid && (
            <p className="gen-error">
              {emptyName && "Every field needs a name. "}
              {dupNames.length > 0 && `Duplicate column name: ${dupNames[0]}. `}
              {!rowsValid && `Rows must be a whole number from 1 to ${MAX_ROWS}. `}
              {!seedValid && "Seed must be a whole number."}
            </p>
          )}
        </section>

        <section className="gen-panel">
          <div className="gen-panel-head">
            <h2>Preview</h2>
            {dataset && (
              <span className="gen-hint">
                first {Math.min(PREVIEW_ROWS, dataset.rows.length)} of {dataset.rows.length} rows
              </span>
            )}
          </div>

          {dataset ? (
            <div className="gen-table-wrap">
              <table className="gen-table">
                <thead>
                  <tr>
                    {fields.map((f) => {
                      const tier = getEntry(f.type).tier;
                      return (
                        <th key={f.id}>
                          <span className={`tier-dot ${TIER_CLASS[tier]}`} aria-hidden="true" />
                          {f.name.trim()}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="gen-hint">Fix the field config above to see a preview.</p>
          )}

          <div className="tier-legend">
            {usedTiers.map((t) => (
              <span key={t} className={`tier-chip ${TIER_CLASS[t]}`}>
                <span className="tier-dot" aria-hidden="true" />
                {TIER_LABEL[t]}
              </span>
            ))}
          </div>
        </section>

        <section className="gen-panel gen-download">
          <div className="gen-panel-head">
            <h2>Download</h2>
          </div>
          <div className="download-row">
            <button
              className="btn btn-primary"
              disabled={!canDownload}
              onClick={() => download("safeseed-data.csv", csv, "text/csv")}
            >
              <Download size={15} aria-hidden="true" /> Download CSV
            </button>
            <button
              className="btn"
              disabled={!canDownload}
              onClick={() =>
                record &&
                download(
                  "safeseed-data.record.json",
                  JSON.stringify(record, null, 2) + "\n",
                  "application/json",
                )
              }
            >
              <ShieldCheck size={15} aria-hidden="true" /> Download run record
            </button>
          </div>

          <div className="gen-note">
            <p>
              Save both files together. The run record pins the whole file and each column with a
              SHA-256 hash, so <code>safeseed verify</code> can later confirm the file is byte-for-byte
              what you generated and flag any drift.
            </p>
            <p>
              Adding your own business columns (job title, industry)? They stay verifiable with
              column-scoped verify:{" "}
              <code>safeseed verify --allow-added-columns</code>. SafeSeed attests the synthetic
              columns it generated; it does <strong>not</strong> vouch for columns you add — point{" "}
              <code>safeseed scan</code> at those. See{" "}
              <a href="./index.html">what this does and doesn&rsquo;t prove</a> for the full boundary.
            </p>
          </div>
        </section>
      </main>

      <footer className="gen-foot">
        <a href="https://github.com/tanjaminben/safeseed">github.com/tanjaminben/safeseed</a>
        <span className="gen-foot-sub">Part of Advokat Frida · Frida&rsquo;s Toolkit</span>
      </footer>
    </div>
  );
}
