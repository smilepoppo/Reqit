import { describe, expect, it } from "vitest";
import { applyUrlChange, clampTimeout, draftToSpec, emptyDraft, specToDraft } from "./draft";
import type { RequestSpec } from "./types";

describe("draft conversion", () => {
  it("converts a draft to a spec without query in the URL", () => {
    const d = applyUrlChange(emptyDraft(), "https://example.com/users?page=2");
    d.method = "POST";
    d.bodyType = "json";
    d.bodyText = '{"a":1}';
    d.authType = "bearer";
    d.token = "dummy-token";
    d.username = "ignored";
    const spec = draftToSpec(d);
    expect(spec).toEqual<RequestSpec>({
      method: "POST",
      url: "https://example.com/users",
      query: [{ key: "page", value: "2", enabled: true }],
      headers: [],
      body: { type: "json", text: '{"a":1}' },
      auth: { type: "bearer", token: "dummy-token" },
      timeoutMs: 30_000,
    });
  });

  it("round-trips through the spec", () => {
    const spec: RequestSpec = {
      method: "PUT",
      url: "https://example.com/a",
      query: [
        { key: "x", value: "1", enabled: true },
        { key: "off", value: "2", enabled: false },
      ],
      headers: [{ key: "Accept", value: "*/*", enabled: true }],
      body: { type: "text", text: "hi" },
      auth: { type: "basic", username: "u", password: "p" },
      timeoutMs: 5000,
    };
    const d = specToDraft(spec);
    expect(d.url).toBe("https://example.com/a?x=1");
    expect(draftToSpec(d)).toEqual(spec);
  });

  it("clamps timeout", () => {
    expect(clampTimeout(-1)).toBe(30);
    expect(clampTimeout(Number.NaN)).toBe(30);
    expect(clampTimeout(0)).toBe(0);
    expect(clampTimeout(9999)).toBe(600);
  });
});
