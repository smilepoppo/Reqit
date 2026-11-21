// URL 欄とクエリパラメーター表の同期。
//
// URL 欄には「有効な」パラメーターだけを表示し、無効化した行は表にだけ残す。
// 送信時は URL からクエリを除いた部分と、表の全行を Rust 側に渡す（Rust 側で有効行だけを付与する）。
// URL 欄の表示は読みやすさを優先し、構造を壊す文字（% & = # +）だけをエンコードする。

import type { KeyValue } from "./types";

export interface UrlParts {
  base: string;
  query: string | null;
  hash: string;
}

export function splitUrl(url: string): UrlParts {
  let rest = url;
  let hash = "";
  const hashIdx = rest.indexOf("#");
  if (hashIdx >= 0) {
    hash = rest.slice(hashIdx);
    rest = rest.slice(0, hashIdx);
  }
  const qIdx = rest.indexOf("?");
  if (qIdx < 0) return { base: rest, query: null, hash };
  return { base: rest.slice(0, qIdx), query: rest.slice(qIdx + 1), hash };
}

function safeDecode(s: string): string {
  const plus = s.replace(/\+/g, " ");
  try {
    return decodeURIComponent(plus);
  } catch {
    return plus;
  }
}

export function parseQuery(query: string): { key: string; value: string }[] {
  if (query === "") return [];
  return query.split("&").map((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return { key: safeDecode(part), value: "" };
    return { key: safeDecode(part.slice(0, eq)), value: safeDecode(part.slice(eq + 1)) };
  });
}

function encodeDisplay(s: string, isKey: boolean): string {
  const pattern = isKey ? /[%&=#+]/g : /[%&#+]/g;
  return s.replace(
    pattern,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
  );
}

export function buildQuery(rows: KeyValue[]): string {
  return rows
    .filter((r) => r.enabled && r.key !== "")
    .map((r) => {
      const k = encodeDisplay(r.key, true);
      return r.value === "" ? k : `${k}=${encodeDisplay(r.value, false)}`;
    })
    .join("&");
}

export function composeUrl(base: string, rows: KeyValue[], hash = ""): string {
  const q = buildQuery(rows);
  return q === "" ? base + hash : `${base}?${q}${hash}`;
}

/** URL 欄の変更を表に反映する。無効化した行は残し、有効な行は URL から作り直す。 */
export function rowsFromUrl(url: string, previous: KeyValue[]): KeyValue[] {
  const { query } = splitUrl(url);
  const parsed =
    query === null ? [] : parseQuery(query).filter((p) => p.key !== "" || p.value !== "");
  const enabled = parsed.map((p) => ({ ...p, enabled: true }));
  const disabled = previous.filter((r) => !r.enabled);
  return [...enabled, ...disabled];
}

/** 表の変更を URL 欄に反映する。 */
export function urlFromRows(url: string, rows: KeyValue[]): string {
  const { base, hash } = splitUrl(url);
  return composeUrl(base, rows, hash);
}

/** 送信・保存用に、URL 欄からクエリとフラグメントを除いた部分を返す。 */
export function baseUrl(url: string): string {
  return splitUrl(url).base.trim();
}
