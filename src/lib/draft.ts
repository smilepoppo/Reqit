// 画面上の編集状態（Draft）と、Rust に渡す RequestSpec の相互変換。

import type { HttpMethod, KeyValue, RequestSpec } from "./types";
import { baseUrl, composeUrl, rowsFromUrl } from "./url";

export type BodyType = "none" | "json" | "text";
export type AuthType = "none" | "basic" | "bearer";

export interface Draft {
  method: HttpMethod;
  /** URL 欄の表示値（有効なクエリパラメーターを含む）。 */
  url: string;
  query: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  bodyText: string;
  authType: AuthType;
  // 認証方式を切り替えても入力内容を失わないよう、全方式の値を保持する。
  username: string;
  password: string;
  token: string;
  timeoutSec: number;
}

export const DEFAULT_TIMEOUT_SEC = 30;
export const MAX_TIMEOUT_SEC = 600;

export function emptyDraft(): Draft {
  return {
    method: "GET",
    url: "",
    query: [],
    headers: [],
    bodyType: "json",
    bodyText: "",
    authType: "none",
    username: "",
    password: "",
    token: "",
    timeoutSec: DEFAULT_TIMEOUT_SEC,
  };
}

export function clampTimeout(sec: number): number {
  if (!Number.isFinite(sec) || sec < 0) return DEFAULT_TIMEOUT_SEC;
  return Math.min(Math.round(sec), MAX_TIMEOUT_SEC);
}

export function draftToSpec(d: Draft): RequestSpec {
  const auth: RequestSpec["auth"] =
    d.authType === "basic"
      ? { type: "basic", username: d.username, password: d.password }
      : d.authType === "bearer"
        ? { type: "bearer", token: d.token }
        : { type: "none" };
  const body: RequestSpec["body"] =
    d.bodyType === "none" ? { type: "none" } : { type: d.bodyType, text: d.bodyText };
  return {
    method: d.method,
    url: baseUrl(d.url),
    query: d.query,
    headers: d.headers,
    body,
    auth,
    timeoutMs: clampTimeout(d.timeoutSec) * 1000,
  };
}

export function specToDraft(s: RequestSpec): Draft {
  const d = emptyDraft();
  d.method = s.method;
  d.query = s.query ?? [];
  d.url = composeUrl(s.url, d.query);
  d.headers = s.headers ?? [];
  if (s.body.type === "none") {
    d.bodyType = "none";
  } else {
    d.bodyType = s.body.type;
    d.bodyText = s.body.text;
  }
  d.authType = s.auth.type;
  if (s.auth.type === "basic") {
    d.username = s.auth.username;
    d.password = s.auth.password;
  } else if (s.auth.type === "bearer") {
    d.token = s.auth.token;
  }
  d.timeoutSec = clampTimeout(s.timeoutMs / 1000);
  return d;
}

/** URL 欄の入力をクエリパラメーター表へ反映する。 */
export function applyUrlChange(d: Draft, url: string): Draft {
  return { ...d, url, query: rowsFromUrl(url, d.query) };
}
