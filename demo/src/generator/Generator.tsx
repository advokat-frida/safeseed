import { useEffect, useMemo, useRef, useState } from "react";
import {
  generate,
  toCsv,
  makeRunRecord,
  CATALOG,
  SCHEMA_PRESETS,
  getSchemaPreset,
  getEntry,
  isSafeColumnName,
  type FieldType,
  type Tier,
  type RunRecord,
  type SchemaPresetId,
} from "safeseed";
import { VerifyPanel } from "./VerifyPanel";
import { Plus, Trash2, Download, ShieldCheck } from "lucide-react";

const MAX_ROWS = 10000;
const MAX_SEED = 0xffffffff;
const PREVIEW_ROWS = 12;

const TIER_CLASS: Record<Tier, string> = {
  "protocol-reserved": "tier-provable",
  "authority-reserved": "tier-reserved",
  "designated-test-only": "tier-designated",
  "structurally-fake": "tier-fake",
};

const TIER_LABEL: Record<Tier, string> = {
  "protocol-reserved": "Protocol reserved",
  "authority-reserved": "Authority reserved",
  "designated-test-only": "Designated for testing",
  "structurally-fake": "Structurally fake",
};

const DERIVED_TIER_LABEL: Record<Tier, string> = {
  "protocol-reserved": "Derived from protocol input",
  "authority-reserved": "Derived from authority input",
  "designated-test-only": "Derived from test input",
  "structurally-fake": "Derived from fake input",
};

const FIELD_LABEL: Partial<Record<FieldType, string>> = {
  email: "Email",
  sha256Email: "Hashed email (SHA-256)",
  domain: "Domain",
  ipv4: "IPv4 address",
  ipv6: "IPv6 address",
  phone: "US phone",
  ukPhone: "UK phone (Ofcom drama)",
  sha256Phone: "Hashed phone (SHA-256)",
  ssn: "US SSN",
  creditCard: "Credit card (test PAN)",
  marketingUrl: "Marketing URL (UTM)",
  opaqueId: "Opaque business ID",
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  streetAddress: "Street address",
  freeText: "Obvious test text",
};

const TYPE_OPTIONS = CATALOG.map((entry) => ({
  value: entry.field as FieldType,
  label: FIELD_LABEL[entry.field] ?? entry.field,
}));

interface FieldRow {
  id: number;
  name: string;
  type: FieldType;
}

interface CurrentRecord {
  csv: string;
  record: RunRecord;
}

function assuranceLabel(type: FieldType): string {
  const entry = getEntry(type);
  return entry.derivation === undefined ? TIER_LABEL[entry.tier] : DERIVED_TIER_LABEL[entry.tier];
}

function rowsFromPreset(id: SchemaPresetId, startId = 1): FieldRow[] {
  return getSchemaPreset(id).schema.map((field, index) => ({
    id: startId + index,
    name: field.name,
    type: field.type,
  }));
}

const DEFAULT_FIELDS = rowsFromPreset("crm-contacts");

function download(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function Generator() {
  const idRef = useRef(DEFAULT_FIELDS.length + 1);
  const columnsHeadingRef = useRef<HTMLHeadingElement>(null);
  const [fields, setFields] = useState<FieldRow[]>(() => DEFAULT_FIELDS.map((field) => ({ ...field })));
  const [rowCount, setRowCount] = useState(100);
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<"generate" | "verify">("generate");
  const [presetStatus, setPresetStatus] = useState("CRM contacts loaded. Six editable columns.");
  const [activePreset, setActivePreset] = useState<SchemaPresetId | null>("crm-contacts");
  const [recordState, setRecordState] = useState<CurrentRecord | null>(null);
  const [recordError, setRecordError] = useState("");

  const trimmedNames = fields.map((field) => field.name.trim());
  const emptyName = trimmedNames.some((name) => name === "");
  const duplicateNames = trimmedNames.filter(
    (name, index) => name !== "" && trimmedNames.indexOf(name) !== index,
  );
  const unsafeNames = trimmedNames.filter((name) => name !== "" && !isSafeColumnName(name));
  const rowsValid = Number.isSafeInteger(rowCount) && rowCount >= 1 && rowCount <= MAX_ROWS;
  const seedValid = Number.isSafeInteger(seed) && seed >= 0 && seed <= MAX_SEED;
  const configValid =
    fields.length > 0 && !emptyName && duplicateNames.length === 0 && unsafeNames.length === 0 && rowsValid && seedValid;

  const schemaKey = JSON.stringify(fields.map((field) => [field.name.trim(), field.type]));
  const schema = useMemo(
    () => fields.map((field) => ({ name: field.name.trim(), type: field.type })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemaKey],
  );
  const dataset = useMemo(
    () => (configValid ? generate({ schema, rows: rowCount, seed }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemaKey, rowCount, seed, configValid],
  );
  const csv = useMemo(
    () => (dataset ? toCsv(dataset.columns, dataset.rows) : ""),
    [dataset],
  );

  useEffect(() => {
    let cancelled = false;
    setRecordError("");
    if (!dataset || csv === "") {
      setRecordState(null);
      return;
    }
    void makeRunRecord(dataset, csv)
      .then((record) => {
        if (!cancelled) setRecordState({ csv, record });
      })
      .catch(() => {
        if (!cancelled) {
          setRecordState(null);
          setRecordError("SafeSeed could not create a matching verification file. Change the settings and try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dataset, csv]);

  const newId = () => idRef.current++;
  const updateField = (id: number, patch: Partial<FieldRow>) => {
    setActivePreset(null);
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };
  const addField = () => {
    const id = newId();
    setActivePreset(null);
    setFields((current) => [
      ...current,
      { id, name: `field_${current.length + 1}`, type: "freeText" },
    ]);
  };
  const removeField = (id: number) => {
    setActivePreset(null);
    setFields((current) => current.filter((field) => field.id !== id));
  };
  const applyPreset = (id: SchemaPresetId) => {
    const preset = getSchemaPreset(id);
    const next = rowsFromPreset(id, idRef.current);
    idRef.current += next.length;
    setFields(next);
    setActivePreset(id);
    setPresetStatus(`${preset.label} loaded. ${next.length} editable columns.`);
    requestAnimationFrame(() => columnsHeadingRef.current?.focus());
  };

  const previewRows = dataset?.rows.slice(0, PREVIEW_ROWS) ?? [];
  const usedAssurances = Array.from(
    new Map(
      fields.map((field) => {
        const entry = getEntry(field.type);
        const key = `${entry.tier}:${entry.derivation === undefined ? "direct" : "derived"}`;
        return [key, { tier: entry.tier, label: assuranceLabel(field.type) }] as const;
      }),
    ).values(),
  );
  const hasDerivedFields = fields.some((field) => getEntry(field.type).derivation !== undefined);
  const currentRecord = recordState?.csv === csv ? recordState.record : null;
  const canDownload = configValid && dataset !== null && csv !== "" && currentRecord !== null;

  return (
    <div className="site">
      <a className="skiplink" href="#main-content">Skip to SafeSeed tool</a>
      <header className="site-bar">
        <a className="bar-wordmark" href="https://advokatfrida.com/">Advokat Frida</a>
        <nav className="bar-nav" aria-label="Sections">
          <ul>
            <li><a href="https://advokatfrida.com/tag/fridas-desk/">Frida&rsquo;s Desk</a></li>
            <li><a href="https://advokatfrida.com/tag/field-guides/">Field Guides</a></li>
            <li><a href="https://advokatfrida.com/tag/toolkit/">Toolkit</a></li>
            <li><a href="https://advokatfrida.com/members/">The Den</a></li>
            <li><a href="https://advokatfrida.com/about/">About</a></li>
          </ul>
        </nav>
      </header>

      <main id="main-content" className="site-main gen-main" tabIndex={-1}>
        <div className="gen-intro">
          <p className="eyebrow">{mode === "generate" ? "Generate" : "Verify"}</p>
          <h1>SafeSeed: In-Browser App</h1>
          <div className="gen-modes" role="group" aria-label="Mode">
            <button type="button" aria-pressed={mode === "generate"} className="gen-mode" onClick={() => setMode("generate")}>Generate</button>
            <button type="button" aria-pressed={mode === "verify"} className="gen-mode" onClick={() => setMode("verify")}>Verify a file</button>
          </div>
          {mode === "generate" ? (
            <>
              <p className="gen-lede">
                Build a test or demo CSV entirely from SafeSeed&rsquo;s catalog. Every column is generated here;
                download the exact CSV and its matching verification file.
              </p>
              <p className="gen-boundary">
                No production file is accepted on this screen. No accounts, analytics, or network requests.
                Downloads are the only exit.
              </p>
            </>
          ) : (
            <>
              <p className="gen-lede">
                Check a SafeSeed CSV against its matching verification file. The browser requires an exact
                whole-file match: bytes, headers, row shape, and catalog ranges.
              </p>
              <p className="gen-boundary">Added or edited columns fail. Both files stay in this browser.</p>
            </>
          )}
        </div>

        {mode === "generate" && (<>
          <section className="gen-panel" aria-labelledby="columns-heading">
            <div className="gen-panel-head">
              <h2 id="columns-heading" ref={columnsHeadingRef} tabIndex={-1}>Columns</h2>
              <span className="gen-hint">Names become the CSV header.</span>
            </div>

            <div className="gen-presets">
              <div className="gen-presets-head">
                <p>Start with a practical schema</p>
                <span>Every preset remains editable.</span>
              </div>
              <div className="preset-grid" role="group" aria-label="Practical schema presets">
                {SCHEMA_PRESETS.map((preset) => (
                  <button
                    type="button"
                    className="preset-btn"
                    key={preset.id}
                    aria-pressed={activePreset === preset.id}
                    onClick={() => applyPreset(preset.id)}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
              <p className="preset-status" aria-live="polite">{presetStatus}</p>
            </div>

            {hasDerivedFields && (
              <p className="derived-note">
                <strong>Hashed does not mean anonymous.</strong> These SHA-256 values come from SafeSeed&rsquo;s
                published allowlist of catalog-constrained inputs. The tier describes the input; the digest
                itself is not reserved or visibly distinguishable from a hash of customer data. An arbitrary
                hash fails.
              </p>
            )}

            <div className="field-list">
              {fields.map((field, index) => {
                const tier = getEntry(field.type).tier;
                const duplicate = field.name.trim() !== "" && duplicateNames.includes(field.name.trim());
                const empty = field.name.trim() === "";
                const unsafe = field.name.trim() !== "" && !isSafeColumnName(field.name.trim());
                const invalid = duplicate || empty || unsafe;
                return (
                  <div className="field-row" key={field.id}>
                    <input
                      className="field-name"
                      value={field.name}
                      spellCheck={false}
                      aria-label={`Column ${index + 1} name`}
                      aria-invalid={invalid}
                      aria-describedby={invalid ? "generator-errors" : undefined}
                      onChange={(event) => updateField(field.id, { name: event.target.value })}
                    />
                    <select
                      className="field-type"
                      value={field.type}
                      aria-label={`Column ${index + 1} type for ${field.name || "unnamed column"}`}
                      onChange={(event) => updateField(field.id, { type: event.target.value as FieldType })}
                    >
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <span className={`tier-chip ${TIER_CLASS[tier]}`}>
                      <span className="tier-dot" aria-hidden="true" />
                      {assuranceLabel(field.type)}
                    </span>
                    <button
                      type="button"
                      className="field-del"
                      aria-label={`Remove ${field.name || `column ${index + 1}`}`}
                      disabled={fields.length === 1}
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="gen-add-row">
              <button type="button" className="btn btn-ghost gen-add" onClick={addField}>
                <Plus size={16} aria-hidden="true" /> Add generated column
              </button>
            </div>

            <div className="gen-nums">
              <label className="num-ctl">
                Rows
                <input
                  type="number"
                  min={1}
                  max={MAX_ROWS}
                  step={1}
                  value={Number.isNaN(rowCount) ? "" : rowCount}
                  aria-invalid={!rowsValid}
                  aria-describedby={!rowsValid ? "generator-errors" : undefined}
                  onChange={(event) => setRowCount(Number(event.target.value))}
                />
              </label>
              <label className="num-ctl">
                Seed
                <input
                  type="number"
                  min={0}
                  max={MAX_SEED}
                  step={1}
                  value={Number.isNaN(seed) ? "" : seed}
                  aria-invalid={!seedValid}
                  aria-describedby={!seedValid ? "generator-errors" : undefined}
                  onChange={(event) => setSeed(Number(event.target.value))}
                />
              </label>
              <span className="gen-hint seed-note">Same seed + columns = identical data, every time.</span>
            </div>

            {!configValid && (
              <p id="generator-errors" className="gen-error" role="alert">
                {emptyName && "Every column needs a name. "}
                {duplicateNames.length > 0 && `Duplicate column name: ${duplicateNames[0]}. `}
                {unsafeNames.length > 0 && "Column names cannot begin with =, +, -, or @. "}
                {!rowsValid && `Rows must be a whole number from 1 to ${MAX_ROWS}. `}
                {!seedValid && `Seed must be a whole number from 0 to ${MAX_SEED}.`}
              </p>
            )}
          </section>

          <section className="gen-panel" aria-labelledby="preview-heading">
            <div className="gen-panel-head">
              <h2 id="preview-heading">Preview</h2>
              {dataset && (
                <span className="gen-hint">
                  first {Math.min(PREVIEW_ROWS, dataset.rows.length)} of {dataset.rows.length} rows
                </span>
              )}
            </div>

            {dataset ? (
              <div className="gen-table-wrap" role="region" aria-label="Generated CSV preview" tabIndex={0}>
                <table className="gen-table">
                  <thead>
                    <tr>
                      {fields.map((field) => (
                        <th key={field.id}>
                          <span className={`tier-dot ${TIER_CLASS[getEntry(field.type).tier]}`} aria-hidden="true" />
                          {field.name.trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, columnIndex) => <td key={columnIndex}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="gen-hint">Fix the column settings above to see a preview.</p>
            )}

            <div className="tier-legend" aria-label="Assurance labels used in this CSV">
              {usedAssurances.map(({ tier, label }) => (
                <span key={`${tier}:${label}`} className={`tier-chip ${TIER_CLASS[tier]}`}>
                  <span className="tier-dot" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </section>

          <section className="gen-panel gen-download" aria-labelledby="download-heading">
            <div className="gen-panel-head"><h2 id="download-heading">Download the pair</h2></div>
            <div className="download-row">
              <button
                type="button"
                className="btn btn-primary"
                data-testid="download-csv"
                disabled={!canDownload}
                onClick={() => download("safeseed-data.csv", csv, "text/csv")}
              >
                <Download size={16} aria-hidden="true" /> Download CSV
              </button>
              <button
                type="button"
                className="btn"
                data-testid="download-record"
                disabled={!canDownload}
                onClick={() => currentRecord && download(
                  "safeseed-data.record.json",
                  `${JSON.stringify(currentRecord, null, 2)}\n`,
                  "application/json",
                )}
              >
                <ShieldCheck size={16} aria-hidden="true" /> Download verification file
              </button>
            </div>
            <p className="download-boundary">Downloading writes the selected files to your device.</p>
            {recordError && <p className="gen-error" role="alert">{recordError}</p>}

            <div className="gen-note">
              <p>
                Save both files together. The verification file records a SHA-256 fingerprint of the exact CSV
                and every generated column. Browser verification fails if bytes, headers, row shape, or catalog
                values change.
              </p>
              <p>
                Keep the verification file under reviewed version control. Anyone who can replace both files can
                recompute both, so this is an integrity check, not authenticated provenance or proof that the file
                contains no personal data.
              </p>
            </div>
          </section>
        </>)}

        {mode === "verify" && <VerifyPanel />}

        <section className="gen-reference" aria-label="SafeSeed reference">
          <details className="gen-changelog">
            <summary>Changelog (last updated: August 20, 2026)</summary>
            <div className="gen-changelog-body">
              <time dateTime="2026-08-20">August 20, 2026</time>
              <strong>Practical sales and marketing schemas</strong>
              <ul>
                <li>Added editable CRM, attribution, hashed-audience, and UK contact presets.</li>
                <li>Added Ofcom drama phones, constrained UTM URLs, obvious business IDs, and catalog-derived SHA-256 match keys.</li>
                <li>The browser now exports and verifies strict whole-file pairs only; arbitrary values never enter the generator.</li>
              </ul>
            </div>
          </details>
          <details className="tier-disclosure">
            <summary>How SafeSeed labels generated fields</summary>
            <ul className="tier-key" aria-label="What the assurance tiers mean">
              <li><span className="tier-dot tier-provable" aria-hidden="true" /><span><strong>Protocol reserved</strong> — a published standard reserves the namespace for documentation or testing.</span></li>
              <li><span className="tier-dot tier-reserved" aria-hidden="true" /><span><strong>Authority reserved</strong> — the cited authority currently marks the range fictitious or invalid.</span></li>
              <li><span className="tier-dot tier-designated" aria-hidden="true" /><span><strong>Designated for testing</strong> — valid-looking and published for processor or sandbox test mode.</span></li>
              <li><span className="tier-dot tier-fake" aria-hidden="true" /><span><strong>Structurally fake</strong> — no standard reserves it, so it is built to be obviously fake.</span></li>
            </ul>
          </details>
        </section>

        <p className="finelegal">
          <strong>Not legal advice.</strong> SafeSeed is a technical control, not proof that a file contains no
          personal data. It does not make any use compliant, and a human stays accountable for anything that
          leaves the building.
        </p>
      </main>

      <footer className="site-colophon">
        <div className="site-colophon-inner">
          <div className="site-colophon-brand">
            <p className="site-colophon-name">Advokat Frida</p>
            <p className="site-colophon-desc">Privacy and AI governance, by design and in practice.<br />No accounts, analytics, or network requests. Your work stays in this browser unless you choose Download.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="site-colophon-nav">
              <li><a href="https://advokatfrida.com/about/">About</a></li>
              <li><a href="https://advokatfrida.com/tag/toolkit/">Toolkit</a></li>
              <li><a href="https://advokatfrida.com/rss/">RSS</a></li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
