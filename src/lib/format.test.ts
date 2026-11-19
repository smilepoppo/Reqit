import { describe, expect, it } from "vitest";
import {
  PRETTY_JSON_LIMIT,
  checkJson,
  formatBytes,
  formatDuration,
  formatJsonText,
  isJsonContentType,
  prettyBody,
} from "./format";

describe("formatBytes / formatDuration", () => {
  it("formats sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20.0 MB");
  });
  it("formats durations", () => {
    expect(formatDuration(12.4)).toBe("12 ms");
    expect(formatDuration(1234)).toBe("1.23 s");
    expect(formatDuration(125_000)).toBe("2m 5s");
  });
});

describe("formatJsonText", () => {
  it("indents nested structures", () => {
    expect(formatJsonText('{"a":1,"b":[1,2],"c":{}}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ],\n  "c": {}\n}',
    );
  });
  it("preserves large integers and duplicate keys exactly", () => {
    const src = '{"id":12345678901234567890,"id":1.000}';
    expect(formatJsonText(src)).toBe('{\n  "id": 12345678901234567890,\n  "id": 1.000\n}');
  });
  it("does not touch characters inside strings", () => {
    expect(formatJsonText('{"s":"a, b: {c} [d] \\"e\\"  "}')).toBe(
      '{\n  "s": "a, b: {c} [d] \\"e\\"  "\n}',
    );
  });
  it("is idempotent", () => {
    const once = formatJsonText('[{"a":[]},{"b":null}]');
    expect(formatJsonText(once)).toBe(once);
  });
});

describe("prettyBody", () => {
  it("formats JSON by content type", () => {
    expect(prettyBody('{"a":1}', "application/json; charset=utf-8")).toEqual({
      text: '{\n  "a": 1\n}',
      language: "json",
    });
  });
  it("detects JSON-looking bodies without content type", () => {
    expect(prettyBody("[1]", undefined).language).toBe("json");
  });
  it("reports invalid JSON when content type says JSON", () => {
    const r = prettyBody("{oops", "application/json");
    expect(r.language).toBe("text");
    expect(r.text).toBe("{oops");
    expect(r.jsonError).toBeTruthy();
  });
  it("leaves plain text alone", () => {
    expect(prettyBody("hello", "text/plain")).toEqual({ text: "hello", language: "text" });
    expect(prettyBody("{not json", "text/html").jsonError).toBeUndefined();
  });
  it("skips formatting for very large bodies", () => {
    const big = "[" + "1,".repeat(PRETTY_JSON_LIMIT / 2) + "1]";
    const r = prettyBody(big, "application/json");
    expect(r.skippedPretty).toBe(true);
    expect(r.text).toBe(big);
  });
  it("recognises +json types", () => {
    expect(isJsonContentType("application/problem+json")).toBe(true);
    expect(isJsonContentType("text/html")).toBe(false);
    expect(checkJson("{}")).toEqual({ valid: true });
  });
});
