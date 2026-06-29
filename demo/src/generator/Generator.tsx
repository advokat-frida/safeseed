import { useEffect, useMemo, useRef, useState } from "react";
import {
  generate,
  toCsv,
  makeRunRecord,
  scan,
  CATALOG,
  getEntry,
  type FieldType,
  type Tier,
  type RunRecord,
  type ScanColumn,
  type ScanResult,
} from "safeseed";
import { VerifyPanel } from "./VerifyPanel";
import { Plus, Trash2, Download, ArrowLeft, ShieldCheck, Check, ShieldAlert } from "lucide-react";
import { getNetworkCount, subscribeNetworkCount } from "../netGuard";

const MAX_ROWS = 10000;
const PREVIEW_ROWS = 12;

// Sentinel "type" for a user-supplied column (their own values, not SafeSeed-generated).
const CUSTOM = "__custom__" as const;
type RowType = FieldType | typeof CUSTOM;

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
  value: e.field as FieldType,
  label: FIELD_LABEL[e.field] ?? e.field,
  tier: e.tier,
}));
// the PII types a user can audit a custom column against
const AUDIT_TYPES: FieldType[] = ["email", "phone", "ssn", "creditCard", "ipv4", "ipv6", "domain"];

interface FieldRow {
  id: number;
  name: string;
  type: RowType;
  values: string; // custom only: comma-separated; cycled across rows
  auditAs: FieldType | ""; // custom only: scan this column as this type ("" = skip)
}

function parseValues(s: string): string[] {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");
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
  const idRef = useRef(5);
  const [fields, setFields] = useState<FieldRow[]>([
    { id: 1, name: "email", type: "email", values: "", auditAs: "" },
    { id: 2, name: "full_name", type: "fullName", values: "", auditAs: "" },
    { id: 3, name: "phone", type: "phone", values: "", auditAs: "" },
    { id: 4, name: "plan", type: CUSTOM, values: "Free, Pro, Enterprise", auditAs: "" },
  ]);
  const [rowCount, setRowCount] = useState(100);
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<"generate" | "verify">("generate");
  const [audit, setAudit] = useState<ScanResult | null>(null);

  const [netCount, setNetCount] = useState(getNetworkCount());
  useEffect(() => subscribeNetworkCount(() => setNetCount(getNetworkCount())), []);

  const safeseedFields = fields.filter((f) => f.type !== CUSTOM);
  const customFields = fields.filter((f) => f.type === CUSTOM);

  // Validation — names become CSV headers, so they must be present and unique. And the whole
  // point is generated data, so at least one SafeSeed (non-custom) column is required.
  const trimmed = fields.map((f) => f.name.trim());
  const emptyName = trimmed.some((n) => n === "");
  const dupNames = trimmed.filter((n, i) => n !== "" && trimmed.indexOf(n) !== i);
  const rowsValid = Number.isInteger(rowCount) && rowCount >= 1 && rowCount <= MAX_ROWS;
  const seedValid = Number.isInteger(seed);
  const noSafeseed = safeseedFields.length === 0;
  const configValid =
    fields.length > 0 && !emptyName && dupNames.length === 0 && rowsValid && seedValid && !noSafeseed;

  // SafeSeed dataset — the columns SafeSeed attests. Custom columns are joined on afterward.
  const safeseedSchema = useMemo(
    () => safeseedFields.map((f) => ({ name: f.name.trim(), type: f.type as FieldType })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(safeseedFields.map((f) => [f.name.trim(), f.type]))],
  );
  const ssDataset = useMemo(
    () => (configValid ? generate({ schema: safeseedSchema, rows: rowCount, seed }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(safeseedSchema), rowCount, seed, configValid],
  );

  // The full table = every column in the user's order. SafeSeed columns pull from the dataset;
  // custom columns cycle through the user's values.
  const fullColumns = fields.map((f) => f.name.trim());
  const fieldsKey = JSON.stringify(fields.map((f) => [f.name.trim(), f.type, f.values]));
  const fullRows = useMemo(() => {
    if (!ssDataset) return [] as string[][];
    const ssIndex = new Map<number, number>();
    safeseedFields.forEach((f, i) => ssIndex.set(f.id, i));
    const customVals = new Map<number, string[]>();
    customFields.forEach((f) => customVals.set(f.id, parseValues(f.values)));
    const out: string[][] = [];
    for (let r = 0; r < ssDataset.rows.length; r++) {
      const row: string[] = [];
      for (const f of fields) {
        if (f.type === CUSTOM) {
          const vals = customVals.get(f.id) ?? [];
          row.push(vals.length ? vals[r % vals.length] : "");
        } else {
          row.push(ssDataset.rows[r][ssIndex.get(f.id)!] ?? "");
        }
      }
      out.push(row);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssDataset, fieldsKey]);

  const csv = useMemo(
    () => (fullRows.length ? toCsv(fullColumns, fullRows) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fullRows, JSON.stringify(fullColumns)],
  );

  // Run record attests the SafeSeed columns and pins the whole file's content hash. Custom
  // columns ride along in the file as unattested (audit them below / column-scoped verify).
  const [record, setRecord] = useState<RunRecord | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!ssDataset || !csv) {
      setRecord(null);
      return;
    }
    void makeRunRecord(ssDataset, csv).then((r) => {
      if (!cancelled) setRecord(r);
    });
    return () => {
      cancelled = true;
    };
  }, [ssDataset, csv]);

  // Any data change invalidates a prior audit.
  useEffect(() => setAudit(null), [fieldsKey, rowCount, seed]);

  const newId = () => idRef.current++;
  const updateField = (id: number, patch: Partial<FieldRow>) =>
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addField = () => {
    const id = newId();
    setFields((fs) => [...fs, { id, name: `field_${fs.length + 1}`, type: "firstName", values: "", auditAs: "" }]);
  };
  const addCustom = () => {
    const id = newId();
    setFields((fs) => [...fs, { id, name: `your_column_${fs.length + 1}`, type: CUSTOM, values: "", auditAs: "" }]);
  };
  const removeField = (id: number) => setFields((fs) => fs.filter((f) => f.id !== id));

  function runAudit() {
    if (!csv) return;
    const columns: ScanColumn[] = [
      ...safeseedFields.map((f) => ({ name: f.name.trim(), type: f.type as FieldType })),
      ...customFields.filter((f) => f.auditAs).map((f) => ({ name: f.name.trim(), type: f.auditAs as FieldType })),
    ];
    setAudit(scan({ csv, columns }));
  }

  const previewRows = fullRows.slice(0, PREVIEW_ROWS);
  const usedTiers = Array.from(new Set(safeseedFields.map((f) => getEntry(f.type as FieldType).tier)));
  const canDownload = configValid && fullRows.length > 0 && record !== null;
  const auditedCustomCount = customFields.filter((f) => f.auditAs).length;

  return (
    <div className="site">
      <header className="site-masthead">
        <a className="site-nameplate" href="https://advokatfrida.com">
          <p className="site-title">Advokat Frida</p>
        </a>
        <p className="site-tagline">
          Privacy and AI governance, by design and in practice. For the people who have to make
          principles actually work.
        </p>
        <nav aria-label="Sections">
          <ul className="site-nav">
            <li><a href="https://advokatfrida.com/tag/fridas-desk/">Frida&rsquo;s Desk</a></li>
            <li><a href="https://advokatfrida.com/tag/field-guides/">Field Guides</a></li>
            <li><a href="https://advokatfrida.com/tag/playbooks/">Playbooks</a></li>
            <li><a href="https://advokatfrida.com/tag/toolkit/">Toolkit</a></li>
            <li><a href="https://advokatfrida.com/about/">About</a></li>
          </ul>
        </nav>
      </header>
      <header className="gen-top">
        <a className="gen-back" href="https://advokatfrida.com/safeseed/">
          <ArrowLeft size={14} aria-hidden="true" /> What SafeSeed is
        </a>
        <div className={`gen-net${netCount > 0 ? " tripped" : ""}`}>
          <span className="airgap-led" aria-hidden="true" />
          {netCount === 0 ? "0 network requests" : `${netCount} network request(s)`}
        </div>
      </header>

      <main className="site-main gen-main">
        <div className="gen-intro">
          <p className="eyebrow">{mode === "generate" ? "Generate" : "Verify"}</p>
          <h1>SafeSeed: In-Browser App</h1>
          <div className="gen-modes" role="tablist" aria-label="Mode">
            <button type="button" role="tab" aria-selected={mode === "generate"} className={`gen-mode${mode === "generate" ? " is-active" : ""}`} onClick={() => setMode("generate")}>Generate</button>
            <button type="button" role="tab" aria-selected={mode === "verify"} className={`gen-mode${mode === "verify" ? " is-active" : ""}`} onClick={() => setMode("verify")}>Verify a file</button>
          </div>
          {mode === "generate" ? (
            <p className="gen-lede">
              Generate safe fake data, add your own columns alongside it, audit the result, and download it.
              Every generated value comes from a standards-reserved range or a structurally fake token. It runs
              entirely in your browser — nothing leaves your device.
            </p>
          ) : (
            <p className="gen-lede">
              Got a CSV and the verification file SafeSeed handed you with it? Drop them both in and confirm the
              file is genuine, unchanged, and made of provably-synthetic data — no install, all in your browser.
            </p>
          )}
          <ul className="tier-key" aria-label="What the honesty tiers mean">
            <li>
              <span className="tier-dot tier-provable" aria-hidden="true" />
              <span>
                <strong>Provably non-real</strong> — a standard reserves it; it cannot be a real person or system.
              </span>
            </li>
            <li>
              <span className="tier-dot tier-reserved" aria-hidden="true" />
              <span>
                <strong>Reserved, never issued</strong> — set aside by the issuing authority and never assigned.
              </span>
            </li>
            <li>
              <span className="tier-dot tier-designated" aria-hidden="true" />
              <span>
                <strong>Designated for testing</strong> — valid-looking, published for sandbox use; authorizes nowhere.
              </span>
            </li>
            <li>
              <span className="tier-dot tier-fake" aria-hidden="true" />
              <span>
                <strong>Structurally fake</strong> — no standard reserves it, so it is built to be obviously fake.
              </span>
            </li>
          </ul>
        </div>

        {mode === "generate" && (<>
        <section className="gen-panel">
          <div className="gen-panel-head">
            <h2>Columns</h2>
            <span className="gen-hint">Names become the CSV header.</span>
          </div>

          <div className="field-list">
            {fields.map((f) => {
              const isCustom = f.type === CUSTOM;
              const tier = isCustom ? null : getEntry(f.type as FieldType).tier;
              const isDup = f.name.trim() !== "" && dupNames.includes(f.name.trim());
              const isEmpty = f.name.trim() === "";
              return (
                <div className={`field-wrap${isCustom ? " is-custom" : ""}`} key={f.id}>
                  <div className="field-row">
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
                      aria-label="Column type"
                      onChange={(e) => updateField(f.id, { type: e.target.value as RowType })}
                    >
                      <optgroup label="SafeSeed (generated, safe)">
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Yours">
                        <option value={CUSTOM}>Your values…</option>
                      </optgroup>
                    </select>
                    {isCustom ? (
                      <span className="field-yours-tag">Your column</span>
                    ) : (
                      <span className={`tier-chip ${TIER_CLASS[tier!]}`}>
                        <span className="tier-dot" aria-hidden="true" />
                        {TIER_LABEL[tier!]}
                      </span>
                    )}
                    <button
                      className="field-del"
                      aria-label={`Remove ${f.name || "column"}`}
                      disabled={fields.length === 1}
                      onClick={() => removeField(f.id)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                  {isCustom && (
                    <div className="field-custom">
                      <input
                        className="field-values"
                        value={f.values}
                        spellCheck={false}
                        aria-label={`Values for ${f.name || "your column"}`}
                        placeholder="Your values, comma-separated (e.g. Free, Pro, Enterprise) — cycled across rows"
                        onChange={(e) => updateField(f.id, { values: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="gen-add-row">
            <button className="btn btn-ghost gen-add" onClick={addField}>
              <Plus size={15} aria-hidden="true" /> Add SafeSeed column
            </button>
            <button className="btn btn-ghost gen-add" onClick={addCustom}>
              <Plus size={15} aria-hidden="true" /> Add your column
            </button>
          </div>

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
            <span className="gen-hint seed-note">Same seed + columns → identical data, every time.</span>
          </div>

          {!configValid && (
            <p className="gen-error">
              {emptyName && "Every column needs a name. "}
              {dupNames.length > 0 && `Duplicate column name: ${dupNames[0]}. `}
              {noSafeseed && "Add at least one SafeSeed (generated) column. "}
              {!rowsValid && `Rows must be a whole number from 1 to ${MAX_ROWS}. `}
              {!seedValid && "Seed must be a whole number."}
            </p>
          )}
        </section>

        <section className="gen-panel">
          <div className="gen-panel-head">
            <h2>Preview</h2>
            {fullRows.length > 0 && (
              <span className="gen-hint">
                first {Math.min(PREVIEW_ROWS, fullRows.length)} of {fullRows.length} rows
              </span>
            )}
          </div>

          {fullRows.length > 0 ? (
            <div className="gen-table-wrap">
              <table className="gen-table">
                <thead>
                  <tr>
                    {fields.map((f) => {
                      const isCustom = f.type === CUSTOM;
                      const tier = isCustom ? null : getEntry(f.type as FieldType).tier;
                      return (
                        <th key={f.id} className={isCustom ? "col-yours" : ""}>
                          <span
                            className={`tier-dot ${isCustom ? "tier-yours" : TIER_CLASS[tier!]}`}
                            aria-hidden="true"
                          />
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
                        <td key={c} className={fields[c]?.type === CUSTOM ? "col-yours" : ""}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="gen-hint">Fix the column config above to see a preview.</p>
          )}

          <div className="tier-legend">
            {usedTiers.map((t) => (
              <span key={t} className={`tier-chip ${TIER_CLASS[t]}`}>
                <span className="tier-dot" aria-hidden="true" />
                {TIER_LABEL[t]}
              </span>
            ))}
            {customFields.length > 0 && (
              <span className="tier-chip tier-chip-yours">
                <span className="tier-dot tier-yours" aria-hidden="true" />
                Your columns (unverified)
              </span>
            )}
          </div>
        </section>

        <section className="gen-panel">
          <div className="gen-panel-head">
            <h2>Audit</h2>
            <span className="gen-hint">Flag any value that is not in a reserved range — real PII that slipped in.</span>
          </div>
          <p className="audit-lede">
            SafeSeed columns are checked against their own type and pass by construction. Point any of
            <strong> your columns</strong> at the kind of data it should hold, and the audit flags
            anything real that crept in.
          </p>

          <div className="audit-cols">
            {fields.map((f) => {
              const isCustom = f.type === CUSTOM;
              return (
                <div className={`audit-col${isCustom ? " is-custom" : ""}`} key={f.id}>
                  <span className="audit-col-name">{f.name.trim() || "—"}</span>
                  {isCustom ? (
                    <label className="audit-as">
                      audit as
                      <select
                        value={f.auditAs}
                        aria-label={`Audit ${f.name || "column"} as`}
                        onChange={(e) => updateField(f.id, { auditAs: e.target.value as FieldType | "" })}
                      >
                        <option value="">skip (not PII)</option>
                        {AUDIT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {FIELD_LABEL[t] ?? t}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="audit-auto">
                      <Check size={13} aria-hidden="true" /> as {FIELD_LABEL[f.type as FieldType] ?? f.type}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="audit-actions">
            <button className="btn btn-primary" disabled={!csv} onClick={runAudit}>
              <ShieldCheck size={15} aria-hidden="true" /> Run audit
            </button>
            <span className="gen-hint">
              {safeseedFields.length} generated + {auditedCustomCount} of {customFields.length} of your columns
            </span>
          </div>

          {audit && (
            <div className={`audit-result ${audit.ok ? "clean" : "dirty"}`} role="status" aria-live="polite">
              <div className="audit-verdict">
                {audit.ok ? <Check size={16} aria-hidden="true" /> : <ShieldAlert size={16} aria-hidden="true" />}
                {audit.ok
                  ? `Clean — every audited value is in its reserved range (${audit.scannedRows} rows).`
                  : `${audit.findings.length} value${audit.findings.length === 1 ? "" : "s"} outside range across ${audit.scannedRows} rows.`}
              </div>
              {!audit.ok && (
                <ul className="audit-findings">
                  {audit.findings.slice(0, 12).map((fd, i) => (
                    <li key={i}>
                      <code>{fd.field}</code> row {fd.row + 1}: <code>{fd.value}</code> — not a safe {fd.type}
                    </li>
                  ))}
                  {audit.findings.length > 12 && <li>…and {audit.findings.length - 12} more.</li>}
                </ul>
              )}
            </div>
          )}
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
                download("safeseed-data.record.json", JSON.stringify(record, null, 2) + "\n", "application/json")
              }
            >
              <ShieldCheck size={15} aria-hidden="true" /> Download verification file
            </button>
          </div>

          <div className="gen-note">
            <p>
              Save both files together. The verification file is a small fingerprint of the data (a SHA-256 hash of
              the whole file and each generated column), so you or your team can later confirm the data is exactly
              what you generated here and catch any tampering. You only need it if you want that check — the CSV
              stands on its own.
            </p>
            {customFields.length > 0 && (
              <p>
                Your {customFields.length} column{customFields.length === 1 ? "" : "s"}
                {" "}ride along in the file but are <strong>not</strong> attested by SafeSeed — that is what the
                audit above is for. Column-scoped verify (<code>safeseed verify --allow-added-columns</code>)
                attests the generated columns and reports yours as added.
              </p>
            )}
          </div>
        </section>
        </>)}
        {mode === "verify" && <VerifyPanel />}
      </main>

      <footer className="site-colophon">
        <div className="site-colophon-inner">
          <div className="site-colophon-brand">
            <div>
              <p className="site-colophon-name">Advokat Frida</p>
              <p className="site-colophon-desc">Privacy and AI governance, by design and in practice.</p>
            </div>
          </div>
          <div className="site-colophon-aside">
            <div className="site-colophon-meta">
              <p className="site-colophon-credit">
                No cookies, no tracking &mdash; this tool runs entirely in your browser.
              </p>
              <p className="site-colophon-copy">
                &copy; 2026 Advokat Frida &middot; Part of Frida&rsquo;s Toolkit &middot;{" "}
                <a href="https://github.com/tanjaminben/safeseed">SafeSeed on GitHub</a>
              </p>
            </div>
            <nav aria-label="Footer">
              <ul className="site-colophon-nav">
                <li>
                  <a href="https://advokatfrida.com/about/">
                    <span className="nav-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                    </span>
                    About
                  </a>
                </li>
                <li>
                  <a href="https://advokatfrida.com/rss/">
                    <span className="nav-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>
                    </span>
                    RSS
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
