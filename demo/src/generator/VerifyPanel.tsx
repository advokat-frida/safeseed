import { useRef, useState } from "react";
import { ShieldCheck, ShieldAlert, Check, X, UploadCloud } from "lucide-react";
import {
  verify,
  sha256Hex,
  type RunRecord,
  type VerifyResult,
  type VerifyFailure,
} from "safeseed";

// A click-or-drop file zone. No network: the file is read locally with File.text().
function FileDrop({
  label,
  hint,
  accept,
  fileName,
  error,
  onFile,
}: {
  label: string;
  hint: string;
  accept: string;
  fileName: string;
  error?: string;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (files: FileList | null) => {
    if (files && files[0]) onFile(files[0]);
  };
  return (
    <div
      className={`file-drop${over ? " is-over" : ""}${error ? " is-error" : fileName ? " is-set" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
    >
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => take(e.target.files)} />
      <UploadCloud size={20} aria-hidden="true" />
      <span className="file-drop-label">{label}</span>
      <span className="file-drop-name">{fileName || hint}</span>
      {error && <span className="file-drop-error">{error}</span>}
    </div>
  );
}

function plainFailure(f: VerifyFailure): string {
  const where = f.row !== undefined ? ` (row ${f.row + 1})` : "";
  switch (f.kind) {
    case "out-of-range-value":
      return `${f.field ?? "A column"}${where}: "${f.value ?? ""}" isn't a provably-synthetic value for that column — it could be real data.`;
    case "missing-column":
      return `The verification file expects a column "${f.field}" that isn't in this CSV.`;
    case "column-hash-mismatch":
      return `Column "${f.field}" has been changed since it was generated.`;
    case "row-arity-mismatch":
      return `Row ${(f.row ?? 0) + 1} has a different number of columns than expected — the file's shape was altered.`;
    default:
      return f.message;
  }
}

export function VerifyPanel() {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvName, setCsvName] = useState("");
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [recordName, setRecordName] = useState("");
  const [recordError, setRecordError] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [genuine, setGenuine] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCsv(f: File) {
    setCsvName(f.name);
    setCsvText(await f.text());
    setResult(null);
  }
  async function onRecord(f: File) {
    setRecordName(f.name);
    setResult(null);
    try {
      const r = JSON.parse(await f.text()) as RunRecord;
      if (!r || typeof r.contentSha256 !== "string" || !Array.isArray(r.fields)) throw new Error("shape");
      setRecord(r);
      setRecordError("");
    } catch {
      setRecord(null);
      setRecordError("Not a SafeSeed verification file — it should be the .json downloaded next to the CSV.");
    }
  }

  async function run() {
    if (!csvText || !record) return;
    setBusy(true);
    const hash = await sha256Hex(csvText);
    setGenuine(hash === record.contentSha256);
    setResult(await verify(csvText, record, { allowAddedColumns: true }));
    setBusy(false);
  }

  const verified = genuine === true && result?.ok === true;
  const added = result ? result.unattestedColumns.filter((c) => c.trim() !== "") : [];

  return (
    <section className="gen-panel verify-panel">
      <div className="gen-panel-head">
        <h2>Verify a file</h2>
        <span className="gen-hint">Nothing is uploaded — the check runs in your browser.</span>
      </div>

      <div className="verify-drops">
        <FileDrop label="Your CSV" hint="click or drop the data file" accept=".csv,text/csv" fileName={csvName} onFile={onCsv} />
        <FileDrop label="Verification file" hint="click or drop the .json" accept=".json,application/json" fileName={recordName} error={recordError} onFile={onRecord} />
      </div>

      <button className="btn btn-primary verify-go" disabled={!csvText || !record || busy} onClick={run}>
        {busy ? "Checking…" : "Verify"}
      </button>

      {result && genuine !== null && (
        <div className={`verify-result ${verified ? "is-pass" : "is-fail"}`}>
          <div className="verify-verdict">
            {verified ? <ShieldCheck size={22} aria-hidden="true" /> : <ShieldAlert size={22} aria-hidden="true" />}
            <span>{verified ? "Verified" : "Not verified"}</span>
          </div>

          <ul className="verify-checks">
            <li className={genuine ? "ok" : "bad"}>
              {genuine ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
              <span>
                <strong>File integrity.</strong>{" "}
                {genuine
                  ? "This is the exact file SafeSeed generated, unmodified."
                  : "This file doesn't match its verification record — it has been changed, or it's the wrong file for this record."}
              </span>
            </li>
            <li className={result.ok ? "ok" : "bad"}>
              {result.ok ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
              <span>
                <strong>SafeSeed columns.</strong>{" "}
                {result.ok
                  ? `All ${result.checked.fields} checked — every value sits in a standards-reserved range.`
                  : `${result.failures.length} issue${result.failures.length === 1 ? "" : "s"} found.`}
              </span>
            </li>
            {added.length > 0 && (
              <li className="note">
                <span>
                  <strong>Your own columns.</strong> {added.join(", ")} {added.length === 1 ? "isn't" : "aren't"} SafeSeed-typed,
                  so SafeSeed can't vouch for {added.length === 1 ? "it" : "them"}. Generate those through SafeSeed if you need them covered.
                </span>
              </li>
            )}
          </ul>

          {result.failures.length > 0 && (
            <ul className="verify-failures">
              {result.failures.slice(0, 12).map((f, i) => (
                <li key={i}>{plainFailure(f)}</li>
              ))}
              {result.failures.length > 12 && <li>…and {result.failures.length - 12} more.</li>}
            </ul>
          )}

          {result.warnings.map((w, i) => (
            <p key={i} className="verify-warning">
              {w}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
