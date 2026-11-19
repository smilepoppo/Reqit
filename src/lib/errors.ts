import type { MessageKey, Params } from "../i18n";
import type { EngineError } from "./types";

/** EngineError をユーザー向けの文言キーと引数に変換する。 */
export function errorMessage(err: EngineError): { key: MessageKey; params?: Params } {
  switch (err.kind) {
    case "unsupportedScheme":
      return { key: "error.unsupportedScheme", params: { scheme: err.scheme } };
    case "invalidHeaderName":
      return { key: "error.invalidHeaderName", params: { name: err.name } };
    case "invalidHeaderValue":
      return { key: "error.invalidHeaderValue", params: { name: err.name } };
    case "timeout":
      return { key: "error.timeout", params: { seconds: Math.round(err.timeoutMs / 100) / 10 } };
    default:
      return { key: `error.${err.kind}` };
  }
}

/** 技術的な詳細（ユーザーが調査に使う）。無い場合は undefined。 */
export function errorDetail(err: EngineError): string | undefined {
  return "detail" in err && err.detail ? err.detail : undefined;
}
