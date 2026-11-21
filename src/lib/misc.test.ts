import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { ja } from "../i18n/ja";
import { translate } from "../i18n";
import { errorMessage } from "./errors";
import { toEngineError } from "./ipc";
import { statusHint, statusTone } from "./status";
import type { EngineError } from "./types";

describe("i18n", () => {
  it("has the same keys and placeholders in every language", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(en[key]), key).toEqual(ph(ja[key]));
      expect(en[key].trim(), key).not.toBe("");
    }
  });
  it("replaces placeholders", () => {
    expect(translate("ja", "error.timeout", { seconds: 3 })).toBe(
      "3 秒以内に応答がなかったため、タイムアウトしました。",
    );
  });
});

describe("status", () => {
  it("classifies status codes", () => {
    expect(statusTone(204)).toBe("success");
    expect(statusTone(301)).toBe("redirect");
    expect(statusTone(404)).toBe("clientError");
    expect(statusTone(503)).toBe("serverError");
    expect(statusTone(101)).toBe("info");
  });
  it("gives hints only for errors", () => {
    expect(statusHint(200)).toBeUndefined();
    expect(statusHint(401)).toBe("status.401");
    expect(statusHint(418)).toBe("status.4xx");
    expect(statusHint(599)).toBe("status.5xx");
  });
});

describe("errors", () => {
  it("maps every engine error kind to a message", () => {
    const all: EngineError[] = [
      { kind: "emptyUrl" },
      { kind: "invalidUrl", detail: "x" },
      { kind: "unsupportedScheme", scheme: "file" },
      { kind: "invalidHeaderName", name: "a b" },
      { kind: "invalidHeaderValue", name: "x" },
      { kind: "timeout", timeoutMs: 1500 },
      { kind: "cancelled" },
      { kind: "dns", detail: "x" },
      { kind: "connect", detail: "x" },
      { kind: "tls", detail: "x" },
      { kind: "tooManyRedirects" },
      { kind: "body", detail: "x" },
      { kind: "other", detail: "x" },
    ];
    for (const e of all) {
      const m = errorMessage(e);
      const text = translate("ja", m.key, m.params);
      expect(text, e.kind).not.toBe(m.key);
      expect(text, e.kind).not.toMatch(/\{\w+\}/);
    }
    expect(
      translate("ja", errorMessage({ kind: "timeout", timeoutMs: 1500 }).key, { seconds: 1.5 }),
    ).toContain("1.5");
  });
  it("normalizes unknown rejection values", () => {
    expect(toEngineError({ kind: "dns", detail: "d" })).toEqual({ kind: "dns", detail: "d" });
    expect(toEngineError("boom")).toEqual({ kind: "other", detail: "boom" });
    expect(toEngineError({ kind: "weird" })).toEqual({ kind: "other", detail: "[object Object]" });
  });
});
