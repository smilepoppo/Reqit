// Rust 側（crates/reqit-core/src/model.rs, error.rs）と対応する型。
// フィールド名を変更する場合は両方を同時に変更すること。

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type Auth =
  | { type: "none" }
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string };

export type Body =
  { type: "none" } | { type: "json"; text: string } | { type: "text"; text: string };

export interface RequestSpec {
  method: HttpMethod;
  url: string;
  query: KeyValue[];
  headers: KeyValue[];
  body: Body;
  auth: Auth;
  timeoutMs: number;
}

export interface ResponseData {
  status: number;
  statusText: string;
  httpVersion: string;
  headers: [string, string][];
  body: string;
  bodyIsUtf8: boolean;
  sizeBytes: number;
  truncated: boolean;
  ttfbMs: number;
  elapsedMs: number;
  finalUrl: string;
}

export type EngineError =
  | { kind: "emptyUrl" }
  | { kind: "invalidUrl"; detail: string }
  | { kind: "unsupportedScheme"; scheme: string }
  | { kind: "invalidHeaderName"; name: string }
  | { kind: "invalidHeaderValue"; name: string }
  | { kind: "timeout"; timeoutMs: number }
  | { kind: "cancelled" }
  | { kind: "dns"; detail: string }
  | { kind: "connect"; detail: string }
  | { kind: "tls"; detail: string }
  | { kind: "tooManyRedirects" }
  | { kind: "body"; detail: string }
  | { kind: "other"; detail: string };

export type SecretPersistence = "none" | "stored" | "tooLarge" | "unavailable";

export interface SaveOutcome {
  secrets: SecretPersistence;
}

// curl のインポート / エクスポート（crates/reqit-core/src/curl.rs と対応）
export type CurlStyle = "bash" | "cmd";

export type CurlWarning =
  | { kind: "unknownOption"; option: string }
  | { kind: "insecureIgnored" }
  | { kind: "fileReferenceIgnored"; option: string }
  | { kind: "multipartIgnored" };

export type CurlError =
  | { kind: "notCurl" }
  | { kind: "unterminatedQuote" }
  | { kind: "missingValue"; option: string }
  | { kind: "missingUrl" }
  | { kind: "invalidUrl" }
  | { kind: "unsupportedMethod"; method: string };

export interface ParsedCurl {
  spec: RequestSpec;
  warnings: CurlWarning[];
}
