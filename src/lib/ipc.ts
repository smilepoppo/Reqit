// Rust 側の IPC コマンドの型付きラッパー。
// HTTP 通信は必ずここから Rust の Request Engine に依頼する（UI から fetch しない）。

import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  CurlError,
  CurlStyle,
  EngineError,
  ParsedCurl,
  RequestSpec,
  ResponseData,
  SaveOutcome,
} from "./types";

export { isTauri };

const KNOWN_KINDS = new Set<EngineError["kind"]>([
  "emptyUrl",
  "invalidUrl",
  "unsupportedScheme",
  "invalidHeaderName",
  "invalidHeaderValue",
  "timeout",
  "cancelled",
  "dns",
  "connect",
  "tls",
  "tooManyRedirects",
  "body",
  "other",
]);

/** invoke の失敗値を EngineError に正規化する。 */
export function toEngineError(e: unknown): EngineError {
  if (
    typeof e === "object" &&
    e !== null &&
    "kind" in e &&
    KNOWN_KINDS.has((e as { kind: EngineError["kind"] }).kind)
  ) {
    return e as EngineError;
  }
  return { kind: "other", detail: e instanceof Error ? e.message : String(e) };
}

export async function sendRequest(requestId: string, spec: RequestSpec): Promise<ResponseData> {
  try {
    return await invoke<ResponseData>("send_request", { requestId, spec });
  } catch (e) {
    throw toEngineError(e);
  }
}

export function cancelRequest(requestId: string): Promise<boolean> {
  return invoke<boolean>("cancel_request", { requestId });
}

export function loadLastRequest(): Promise<RequestSpec | null> {
  return invoke<RequestSpec | null>("load_last_request");
}

export function saveLastRequest(spec: RequestSpec): Promise<SaveOutcome> {
  return invoke<SaveOutcome>("save_last_request", { spec });
}

/** curl コマンドかどうかを判定する（貼り付け時の自動読み込みに使う）。 */
export function looksLikeCurl(text: string): boolean {
  return /^\s*curl(\.exe)?\s/i.test(text);
}

export async function parseCurl(input: string): Promise<ParsedCurl> {
  try {
    return await invoke<ParsedCurl>("parse_curl", { input });
  } catch (e) {
    if (typeof e === "object" && e !== null && "kind" in e) throw e as CurlError;
    throw { kind: "notCurl" } satisfies CurlError;
  }
}

export function exportCurl(spec: RequestSpec, style: CurlStyle): Promise<string> {
  return invoke<string>("export_curl", { spec, style });
}
