//! 通信データの共通モデル。
//!
//! 取得方法（Reqit 自身の送信、内蔵ブラウザ、プロキシ）に関係なく、
//! リクエストとレスポンスを同じ型で扱う。フロントエンドとは camelCase の JSON でやり取りする。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    #[default]
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

impl HttpMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
            Self::Put => "PUT",
            Self::Patch => "PATCH",
            Self::Delete => "DELETE",
        }
    }
}

/// ヘッダーやクエリパラメーターの 1 行。`enabled` が false の行は送信しない。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValue {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

impl KeyValue {
    pub fn new(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value: value.into(),
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Auth {
    #[default]
    None,
    Basic {
        username: String,
        password: String,
    },
    Bearer {
        token: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Body {
    #[default]
    None,
    Json {
        text: String,
    },
    Text {
        text: String,
    },
}

pub const DEFAULT_TIMEOUT_MS: u64 = 30_000;

/// 送信するリクエストの定義。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestSpec {
    #[serde(default)]
    pub method: HttpMethod,
    pub url: String,
    /// URL に追加するクエリパラメーター。URL に既に含まれるクエリの後ろに追加する。
    #[serde(default)]
    pub query: Vec<KeyValue>,
    #[serde(default)]
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub body: Body,
    #[serde(default)]
    pub auth: Auth,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
}

fn default_timeout() -> u64 {
    DEFAULT_TIMEOUT_MS
}

impl Default for RequestSpec {
    fn default() -> Self {
        Self {
            method: HttpMethod::Get,
            url: String::new(),
            query: Vec::new(),
            headers: Vec::new(),
            body: Body::None,
            auth: Auth::None,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        }
    }
}

/// 受信したレスポンス。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseData {
    pub status: u16,
    /// 標準の理由句（例: "Not Found"）。不明なコードでは空文字。
    pub status_text: String,
    pub http_version: String,
    /// 受信順のヘッダー。同名ヘッダーが複数ある場合はそれぞれ 1 行になる。
    pub headers: Vec<(String, String)>,
    /// 本文。UTF-8 として不正なバイト列は置換文字に変換する。
    pub body: String,
    /// 本文が UTF-8 として正しく解釈できたか。false の場合はバイナリの可能性がある。
    pub body_is_utf8: bool,
    /// 実際に受信した本文のバイト数（切り詰めた場合は読み込んだ分）。
    pub size_bytes: u64,
    /// 上限を超えたため本文を途中で打ち切った場合に true。
    pub truncated: bool,
    /// 送信開始からレスポンスヘッダー受信までの時間。
    pub ttfb_ms: u64,
    /// 送信開始から本文受信完了までの時間。
    pub elapsed_ms: u64,
    /// リダイレクト後の最終 URL。
    pub final_url: String,
}

/// 通信の取得元。v0.1 では `Direct` のみ使用する。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CaptureSource {
    /// Reqit 自身が送信した通信。
    Direct,
    /// 内蔵ブラウザで発生した通信（v0.3 予定）。
    Browser,
    /// ローカルプロキシ経由で取得した通信（v0.4 以降予定）。
    Proxy,
}

/// 1 回分の通信（リクエストとレスポンスの組）。履歴やキャプチャ一覧の共通単位にする。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpExchange {
    pub source: CaptureSource,
    pub request: RequestSpec,
    pub response: Option<ResponseData>,
    /// UNIX 時刻（ミリ秒）。
    pub started_at_ms: u64,
}
