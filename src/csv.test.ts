import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "./csv.js";

describe("csv.roundTrip", () => {
  it("round-trips plain values", () => {
    const columns = ["a", "b"];
    const rows = [
      ["1", "2"],
      ["3", "4"],
    ];
    const back = parseCsv(toCsv(columns, rows));
    expect(back.columns).toEqual(columns);
    expect(back.rows).toEqual(rows);
  });

  it("round-trips values containing commas, quotes, and newlines", () => {
    const columns = ["note", "name"];
    const rows = [
      ['has, comma', 'has "quote"'],
      ["has\nnewline", "plain"],
      ["", "trailing-empty"],
    ];
    const back = parseCsv(toCsv(columns, rows));
    expect(back.columns).toEqual(columns);
    expect(back.rows).toEqual(rows);
  });

  it("emits a trailing newline and no phantom final row", () => {
    const csv = toCsv(["a"], [["1"], ["2"]]);
    expect(csv.endsWith("\n")).toBe(true);
    expect(parseCsv(csv).rows).toEqual([["1"], ["2"]]);
  });

  it("serializes a header-only dataset", () => {
    const csv = toCsv(["a", "b"], []);
    expect(csv).toBe("a,b\n");
    const back = parseCsv(csv);
    expect(back.columns).toEqual(["a", "b"]);
    expect(back.rows).toEqual([]);
  });
});

describe("csv.parse edge cases", () => {
  it("handles CRLF line endings", () => {
    const back = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(back.columns).toEqual(["a", "b"]);
    expect(back.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("parses a quoted field with an embedded comma and escaped quote", () => {
    const back = parseCsv('a,b\n"x,y","he said ""hi"""\n');
    expect(back.rows).toEqual([["x,y", 'he said "hi"']]);
  });

  it("preserves empty trailing and leading cells", () => {
    const back = parseCsv("a,b,c\n,mid,\n");
    expect(back.rows).toEqual([["", "mid", ""]]);
  });

  it("handles a file with no trailing newline", () => {
    const back = parseCsv("a,b\n1,2");
    expect(back.rows).toEqual([["1", "2"]]);
  });

  it("keeps a quoted empty field distinct from a missing one", () => {
    const back = parseCsv('a,b\n"",x\n');
    expect(back.rows).toEqual([["", "x"]]);
  });
});
