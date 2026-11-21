// 表示用の整形処理。

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** 整形表示を試みる JSON の上限サイズ。これを超える場合は Raw のまま表示する。 */
export const PRETTY_JSON_LIMIT = 5 * 1024 * 1024;

export function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime === "application/json" || mime.endsWith("+json") || mime === "text/json";
}

export function headerValue(headers: [string, string][], name: string): string | undefined {
  const lower = name.toLowerCase();
  return headers.find(([k]) => k.toLowerCase() === lower)?.[1];
}

/**
 * JSON を字句単位で整形する。
 *
 * JSON.parse → JSON.stringify では、2^53 を超える整数の精度が落ちたり、
 * 重複キーが消えたりする。API のデバッグでは元の値を正確に見せたいため、
 * 値を解釈せずに空白と改行だけを整える。入力が正しい JSON であることは呼び出し側で確認する。
 */
export function formatJsonText(text: string, indent = "  "): string {
  let out = "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  const newline = () => "\n" + indent.repeat(depth);

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    switch (c) {
      case '"':
        inString = true;
        out += c;
        break;
      case "{":
      case "[": {
        // 空のオブジェクト・配列は 1 行で表示する。
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j]!)) j++;
        const close = c === "{" ? "}" : "]";
        if (text[j] === close) {
          out += c + close;
          i = j;
        } else {
          depth++;
          out += c + newline();
        }
        break;
      }
      case "}":
      case "]":
        depth = Math.max(0, depth - 1);
        out += newline() + c;
        break;
      case ",":
        out += "," + newline();
        break;
      case ":":
        out += ": ";
        break;
      case " ":
      case "\t":
      case "\n":
      case "\r":
        break;
      default:
        out += c;
    }
  }
  return out;
}

export type JsonCheck = { valid: true } | { valid: false; message: string };

export function checkJson(text: string): JsonCheck {
  try {
    JSON.parse(text);
    return { valid: true };
  } catch (e) {
    return { valid: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export interface PrettyBody {
  text: string;
  language: "json" | "text";
  /** JSON として表示しようとしたが解析できなかった場合のメッセージ。 */
  jsonError?: string;
  /** 大きすぎるため整形を省略した。 */
  skippedPretty?: boolean;
}

export function prettyBody(body: string, contentType: string | undefined): PrettyBody {
  const trimmed = body.trimStart();
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!isJsonContentType(contentType) && !looksJson) {
    return { text: body, language: "text" };
  }
  if (body.length > PRETTY_JSON_LIMIT) {
    return { text: body, language: "json", skippedPretty: true };
  }
  const check = checkJson(body);
  if (!check.valid) {
    // Content-Type が JSON なのに解析できない場合だけエラーとして伝える。
    return isJsonContentType(contentType)
      ? { text: body, language: "text", jsonError: check.message }
      : { text: body, language: "text" };
  }
  return { text: formatJsonText(body), language: "json" };
}
