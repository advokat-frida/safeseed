import { useRef, useState } from "react";
import { ShieldCheck, ShieldAlert, Check, X, UploadCloud } from "lucide-react";
import {
  verify,
  validateRunRecord,
  type RunRecord,
  type VerifyResult,
  type VerifyFailure,
} from "safeseed";

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
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (files: FileList | null) => {
    if (files?.[0]) onFile(files[0]);
  };

  return (
    <div
      className={`file-drop${over ? " is-over" : ""}${error ? " is-error" : fileName ? " is-set" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${label}. ${fileName || hint}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files);
      }}
    >
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(event) => take(event.target.files)} />
      <UploadCloud size={20} aria-hidden="true" />
      <span className="file-drop-label">{label}</span>
      <span className="file-drop-name">{fileName || hint}</span>
      {error && <span className="file-drop-error">{error}</span>}
    </div>
  );
}

function plainFailure(failure: VerifyFailure): string {
  const where = failure.row !== undefined ? ` (row ${failure.row + 1})` : "";
  switch (failure.kind) {
    case "content-hash-mismatch":
      return "The current CSV fingerprint does not match this verification file.";
    case "malformed-csv":
      return `The CSV syntax is malformed, so SafeSeed stopped without checking any values. ${failure.message}`;
    case "out-of-range-value":
      return `${failure.field ?? "A column"}${where}: candidate value redacted; it isn't inside the catalog constraint for that column.`;
    case "missing-column":
      return `The verification file expects a column "${failure.field}" that isn't in this CSV.`;
    case "column-hash-mismatch":
      return `Column "${failure.field}" has been changed since it was generated.`;
    case "row-arity-mismatch":
      return `Row ${(failure.row ?? 0) + 1} has a different number of columns than expected.`;
    case "schema-mismatch":
      return failure.field
        ? `The recorded column "${failure.field}" is duplicated or otherwise ambiguous.`
        : "The CSV headers or column order do not exactly match this verification file.";
    default:
      return failure.message;
  }
}

export function VerifyPanel() {
  const csvReadRef = useRef(0);
  const recordReadRef = useRef(0);
  const pairRevisionRef = useRef(0);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvName, setCsvName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [recordName, setRecordName] = useState("");
  const [pairError, setPairError] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCsv(file: File) {
    const readId = ++csvReadRef.current;
    pairRevisionRef.current++;
    setCsvName(file.name);
    setCsvText(null);
    setCsvError("");
    setPairError("");
    setResult(null);
    setBusy(false);
    try {
      const text = await file.text();
      if (readId === csvReadRef.current) setCsvText(text);
    } catch {
      if (readId === csvReadRef.current) {
        setCsvText(null);
        setCsvError("SafeSeed could not read this CSV. Choose the file again.");
      }
    }
  }

  async function onRecord(file: File) {
    const readId = ++recordReadRef.current;
    pairRevisionRef.current++;
    setRecordName(file.name);
    setRecord(null);
    setPairError("");
    setResult(null);
    setBusy(false);
    try {
      const validation = validateRunRecord(JSON.parse(await file.text()));
      if (!validation.ok) throw new Error("invalid record");
      if (readId === recordReadRef.current) setRecord(validation.record);
    } catch {
      if (readId === recordReadRef.current) {
        setRecord(null);
        setPairError("Not a current SafeSeed verification file. Use the .json downloaded next to the CSV.");
      }
    }
  }

  async function run() {
    if (csvText === null || !record) return;
    const revision = pairRevisionRef.current;
    const selectedCsv = csvText;
    const selectedRecord = record;
    setBusy(true);
    try {
      const next = await verify(selectedCsv, selectedRecord);
      if (revision === pairRevisionRef.current) {
        setResult(next);
        setPairError("");
      }
    } catch {
      if (revision === pairRevisionRef.current) {
        setResult(null);
        setPairError("SafeSeed could not read this pair. Check both files and try again.");
      }
    } finally {
      if (revision === pairRevisionRef.current) setBusy(false);
    }
  }

  const fingerprintOk = result
    ? !result.failures.some((failure) => failure.kind === "content-hash-mismatch")
    : false;
  const schemaAndRangesOk = result
    ? !result.failures.some((failure) => failure.kind !== "content-hash-mismatch")
    : false;
  const rowArityCount = result
    ? result.failures.filter((failure) => failure.kind === "row-arity-mismatch").length
    : 0;
  const otherFailures = result
    ? result.failures.filter((failure) => failure.kind !== "row-arity-mismatch")
    : [];
  const schemaRangeOrSyntaxCount = result
    ? result.failures.filter(
        (failure) => failure.kind !== "content-hash-mismatch" && failure.kind !== "row-arity-mismatch",
      ).length
    : 0;

  return (
    <section className="gen-panel verify-panel" aria-labelledby="verify-heading">
      <div className="gen-panel-head">
        <h2 id="verify-heading">Verify the exact pair</h2>
        <span className="gen-hint">Files stay local.</span>
      </div>

      <p className="verify-scope">
        Choose the CSV and verification file downloaded together. This browser check is strict: an added,
        removed, reordered, or edited column fails.
      </p>

      <div className="verify-drops">
        <FileDrop label="SafeSeed CSV" hint="click or drop the data file" accept=".csv,text/csv" fileName={csvName} error={csvError} onFile={onCsv} />
        <FileDrop label="Verification file" hint="click or drop the .json" accept=".json,application/json" fileName={recordName} error={pairError} onFile={onRecord} />
      </div>

      <button type="button" className="btn btn-primary verify-go" disabled={csvText === null || !record || busy} onClick={run}>
        {busy ? "Checking…" : "Verify exact pair"}
      </button>

      {result && (
        <div className={`verify-result ${result.ok ? "is-pass" : "is-fail"}`} role="status" aria-live="polite">
          <div className="verify-verdict">
            {result.ok ? <ShieldCheck size={22} aria-hidden="true" /> : <ShieldAlert size={22} aria-hidden="true" />}
            <span>{result.ok ? "Verified" : "Not verified"}</span>
          </div>

          <ul className="verify-checks">
            <li className={fingerprintOk ? "ok" : "bad"}>
              {fingerprintOk ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
              <span>
                <strong>Whole-file fingerprint.</strong>{" "}
                {fingerprintOk
                  ? "The current CSV bytes match this verification file."
                  : "The CSV bytes differ, or this is the wrong verification file."}
              </span>
            </li>
            <li className={schemaAndRangesOk ? "ok" : "bad"}>
              {schemaAndRangesOk ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
              <span>
                <strong>Full schema and catalog ranges.</strong>{" "}
                {schemaAndRangesOk
                  ? `All ${result.checked.fields} columns and ${result.checked.rows} rows match the recorded shape and current constraints.`
                  : `Schema, syntax, or catalog checks failed.${schemaRangeOrSyntaxCount > 0 ? ` ${schemaRangeOrSyntaxCount} schema, range, or syntax issue${schemaRangeOrSyntaxCount === 1 ? "" : "s"} found.` : ""}${rowArityCount > 0 ? ` ${rowArityCount} row${rowArityCount === 1 ? " has" : "s have"} a different width.` : ""}`}
              </span>
            </li>
          </ul>

          {result.failures.length > 0 && (
            <ul className="verify-failures">
              {otherFailures.slice(0, 11).map((failure, index) => <li key={index}>{plainFailure(failure)}</li>)}
              {rowArityCount > 0 && (
                <li>{rowArityCount} row{rowArityCount === 1 ? " has" : "s have"} a different number of columns than the recorded schema.</li>
              )}
              {otherFailures.length > 11 && <li>…and {otherFailures.length - 11} more non-structural findings.</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
