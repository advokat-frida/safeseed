/**
 * Minimal, correct CSV (RFC 4180-ish) serializer and parser. Kept in-house so the
 * core has no runtime dependency to audit. Review the small versioned catalog,
 * then verify each artifact against the current contract.
 */
/** Serialize columns + rows to a CSV string with a trailing newline. */
export function toCsv(columns, rows) {
    const escape = (v) => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const header = columns.map(escape).join(",");
    if (rows.length === 0)
        return `${header}\n`;
    const body = rows.map((r) => r.map(escape).join(",")).join("\n");
    return `${header}\n${body}\n`;
}
/**
 * Canonical serialization of one column's cell values, used for the per-column
 * hash in a run record. JSON encoding is unambiguous — a comma, quote, or newline
 * inside a cell can't collide with the delimiter — so two columns hash equal iff
 * their ordered values are identical. Generation and column-scoped verify both go
 * through this one function, so they can never disagree on what a column "is".
 */
export function canonicalColumn(values) {
    return JSON.stringify(values);
}
/** Parse a CSV string into header columns and data rows. */
export function parseCsv(text) {
    const records = [];
    let field = "";
    let record = [];
    let inQuotes = false;
    let afterQuote = false;
    let fieldStarted = false;
    let recordStarted = false;
    const syntaxError = (message, offset) => {
        throw new Error(`malformed CSV at character ${offset + 1}: ${message}`);
    };
    const pushField = () => {
        record.push(field);
        field = "";
        fieldStarted = false;
        afterQuote = false;
    };
    const pushRecord = () => {
        pushField();
        records.push(record);
        record = [];
        recordStarted = false;
    };
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                    afterQuote = true;
                }
            }
            else {
                field += c;
            }
            continue;
        }
        if (afterQuote) {
            if (c === ",") {
                pushField();
                recordStarted = true;
            }
            else if (c === "\n") {
                pushRecord();
            }
            else if (c === "\r") {
                if (text[i + 1] === "\n")
                    i++;
                pushRecord();
            }
            else {
                syntaxError("only a delimiter or record break may follow a closing quote", i);
            }
            continue;
        }
        if (c === '"') {
            if (fieldStarted || field.length > 0) {
                syntaxError("a quoted field must begin at the start of a cell", i);
            }
            inQuotes = true;
            fieldStarted = true;
            recordStarted = true;
        }
        else if (c === ",") {
            pushField();
            recordStarted = true;
        }
        else if (c === "\n") {
            pushRecord();
        }
        else if (c === "\r") {
            if (text[i + 1] === "\n")
                i++;
            pushRecord();
        }
        else {
            field += c;
            fieldStarted = true;
            recordStarted = true;
        }
    }
    if (inQuotes) {
        syntaxError("quoted field is not closed", Math.max(0, text.length - 1));
    }
    // Flush a final record only if the file did not end on a clean record break.
    if (recordStarted || fieldStarted || field.length > 0 || record.length > 0) {
        pushRecord();
    }
    const columns = records.shift() ?? [];
    return { columns, rows: records };
}
//# sourceMappingURL=csv.js.map