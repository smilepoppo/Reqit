//! 通信エラーの分類。
//!
//! ユーザー向けの文言は UI 側の辞書で決めるため、ここでは種類（`kind`）と
//! 補足情報だけを返す。`detail` には URL のクエリやヘッダー値などの秘密情報を含めない。

use serde::Serialize;
use std::error::Error as StdError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, thiserror::Error)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum EngineError {
    #[error("URL が空です")]
    EmptyUrl,
    #[error("URL を解析できません: {detail}")]
    InvalidUrl { detail: String },
    #[error("対応していないスキームです: {scheme}")]
    UnsupportedScheme { scheme: String },
    #[error("ヘッダー名が不正です: {name}")]
    InvalidHeaderName { name: String },
    #[error("ヘッダー値が不正です: {name}")]
    InvalidHeaderValue { name: String },
    #[error("タイムアウトしました ({timeout_ms} ms)")]
    Timeout {
        #[serde(rename = "timeoutMs")]
        timeout_ms: u64,
    },
    #[error("キャンセルされました")]
    Cancelled,
    #[error("ホスト名を解決できません")]
    Dns { detail: String },
    #[error("接続できません")]
    Connect { detail: String },
    #[error("TLS エラー")]
    Tls { detail: String },
    #[error("リダイレクトが多すぎます")]
    TooManyRedirects,
    #[error("レスポンス本文の受信に失敗しました")]
    Body { detail: String },
    #[error("通信エラー")]
    Other { detail: String },
}

impl EngineError {
    /// reqwest のエラーを分類する。
    ///
    /// reqwest は DNS や TLS の失敗を専用の型で公開していないため、
    /// エラーの原因チェーンの文言から判定する。判定できない場合は `Connect` / `Other` に倒す。
    pub(crate) fn from_reqwest(err: &reqwest::Error, timeout_ms: u64) -> Self {
        if err.is_timeout() {
            return Self::Timeout { timeout_ms };
        }
        if err.is_redirect() {
            return Self::TooManyRedirects;
        }
        let chain = source_chain(err);
        let lower = chain.to_lowercase();
        if lower.contains("certificate")
            || lower.contains("tls")
            || lower.contains("handshake")
            || lower.contains("invalid peer")
        {
            return Self::Tls { detail: chain };
        }
        if lower.contains("dns")
            || lower.contains("failed to lookup")
            || lower.contains("name or service not known")
            || lower.contains("no such host")
            || lower.contains("nodename nor servname")
        {
            return Self::Dns { detail: chain };
        }
        if err.is_connect() {
            return Self::Connect { detail: chain };
        }
        if err.is_body() || err.is_decode() {
            return Self::Body { detail: chain };
        }
        Self::Other { detail: chain }
    }
}

/// 原因チェーンを 1 行にまとめる。reqwest の最上位メッセージは URL を含むため使わない。
fn source_chain(err: &reqwest::Error) -> String {
    let mut parts = Vec::new();
    let mut current: Option<&(dyn StdError + 'static)> = err.source();
    while let Some(e) = current {
        let msg = e.to_string();
        if !parts.contains(&msg) {
            parts.push(msg);
        }
        current = e.source();
    }
    if parts.is_empty() {
        // 原因が無い場合も URL を出さない。
        let mut e = err.to_string();
        if let Some(url) = err.url() {
            e = e.replace(url.as_str(), "<url>");
        }
        return e;
    }
    parts.join(": ")
}
