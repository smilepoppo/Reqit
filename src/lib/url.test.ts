import { describe, expect, it } from "vitest";
import { baseUrl, buildQuery, parseQuery, rowsFromUrl, splitUrl, urlFromRows } from "./url";
import type { KeyValue } from "./types";

const kv = (key: string, value: string, enabled = true): KeyValue => ({ key, value, enabled });

describe("splitUrl", () => {
  it("splits base, query and hash", () => {
    expect(splitUrl("https://example.com/a?x=1&y=2#top")).toEqual({
      base: "https://example.com/a",
      query: "x=1&y=2",
      hash: "#top",
    });
    expect(splitUrl("https://example.com")).toEqual({
      base: "https://example.com",
      query: null,
      hash: "",
    });
  });
});

describe("parseQuery", () => {
  it("decodes percent-encoding and plus signs", () => {
    expect(parseQuery("q=a+b&name=%E6%97%A5%E6%9C%AC&flag")).toEqual([
      { key: "q", value: "a b" },
      { key: "name", value: "日本" },
      { key: "flag", value: "" },
    ]);
  });
  it("keeps malformed escapes as-is", () => {
    expect(parseQuery("p=100%")).toEqual([{ key: "p", value: "100%" }]);
  });
  it("only splits on the first equals sign", () => {
    expect(parseQuery("token=a=b")).toEqual([{ key: "token", value: "a=b" }]);
  });
});

describe("buildQuery", () => {
  it("skips disabled and empty-key rows", () => {
    expect(buildQuery([kv("a", "1"), kv("b", "2", false), kv("", "x")])).toBe("a=1");
  });
  it("round-trips reserved characters", () => {
    const rows = [kv("k&=", "a+b & c=100%#"), kv("日本語", "値 です")];
    const parsed = parseQuery(buildQuery(rows));
    expect(parsed).toEqual(rows.map(({ key, value }) => ({ key, value })));
  });
});

describe("URL and table synchronization", () => {
  it("keeps disabled rows when the URL changes", () => {
    const prev = [kv("a", "1"), kv("off", "x", false)];
    expect(rowsFromUrl("https://example.com?a=2&b=3", prev)).toEqual([
      kv("a", "2"),
      kv("b", "3"),
      kv("off", "x", false),
    ]);
  });
  it("rebuilds the URL from the table, preserving the hash", () => {
    expect(urlFromRows("https://example.com/p?old=1#h", [kv("n", "v"), kv("z", "1", false)])).toBe(
      "https://example.com/p?n=v#h",
    );
    expect(urlFromRows("https://example.com/p?old=1", [])).toBe("https://example.com/p");
  });
  it("returns the base URL for sending", () => {
    expect(baseUrl("  https://example.com/p?x=1#y ")).toBe("https://example.com/p");
  });
});
