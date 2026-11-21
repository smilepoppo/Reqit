//! Request Engine：HTTP リクエストの組み立てと送信。

use std::time::{Duration, Instant};

use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method, redirect};
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::error::EngineError;
use crate::model::{Auth, Body, HttpMethod, KeyValue, RequestSpec, ResponseData};

/// 既定で読み込むレスポンス本文の上限（20 MiB）。
pub const DEFAULT_MAX_BODY_BYTES: usize = 20 * 1024 * 1024;
/// 追従するリダイレクトの上限。
pub const MAX_REDIRECTS: usize = 10;
/// タイムアウトに指定できる上限（10 分）。
pub const MAX_TIMEOUT_MS: u64 = 10 * 60 * 1000;

#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub max_body_bytes: usize,
    pub user_agent: String,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            max_body_bytes: DEFAULT_MAX_BODY_BYTES,
            user_agent: format!("Reqit/{}", env!("CARGO_PKG_VERSION")),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Engine {
    client: Client,
    config: EngineConfig,
}

impl Engine {
    pub fn new(config: EngineConfig) -> Result<Self, EngineError> {
        // Cookie は保持しない（reqwest の cookies 機能を無効にしている）。
        // TLS 証明書は常に検証する。別ホストへのリダイレクトでは reqwest が
        // Authorization / Cookie などの機密ヘッダーを自動で除去する。
        let client = Client::builder()
            .user_agent(&config.user_agent)
            .redirect(redirect::Policy::limited(MAX_REDIRECTS))
            .build()
            .map_err(|e| EngineError::Other {
                detail: e.to_string(),
            })?;
        Ok(Self { client, config })
    }

    /// リクエストを送信し、本文まで受信する。
    ///
    /// `cancel` が発火した場合は `EngineError::Cancelled` を返し、通信を中断する。
    /// `timeout_ms` はヘッダー受信だけでなく本文受信までを含む全体の制限時間。0 は無制限。
    pub async fn send(
        &self,
        spec: &RequestSpec,
        cancel: &CancellationToken,
    ) -> Result<ResponseData, EngineError> {
        let request = build_request(&self.client, spec)?;
        let timeout_ms = spec.timeout_ms.min(MAX_TIMEOUT_MS);
        let exec = self.execute(request, timeout_ms);

        tokio::select! {
            biased;
            _ = cancel.cancelled() => Err(EngineError::Cancelled),
            result = async {
                if timeout_ms == 0 {
                    exec.await
                } else {
                    tokio::time::timeout(Duration::from_millis(timeout_ms), exec)
                        .await
                        .unwrap_or(Err(EngineError::Timeout { timeout_ms }))
                }
            } => result,
        }
    }

    async fn execute(
        &self,
        request: reqwest::Request,
        timeout_ms: u64,
    ) -> Result<ResponseData, EngineError> {
        let started = Instant::now();
        let mut response = self
            .client
            .execute(request)
            .await
            .map_err(|e| EngineError::from_reqwest(&e, timeout_ms))?;
        let ttfb_ms = elapsed_ms(started);

        let status = response.status();
        let http_version = format!("{:?}", response.version());
        let final_url = response.url().to_string();
        let headers = response
            .headers()
            .iter()
            .map(|(k, v)| {
                (
                    k.as_str().to_owned(),
                    String::from_utf8_lossy(v.as_bytes()).into_owned(),
                )
            })
            .collect();

        let max = self.config.max_body_bytes;
        let mut buf: Vec<u8> = Vec::new();
        let mut truncated = false;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| EngineError::from_reqwest(&e, timeout_ms))?
        {
            let remaining = max.saturating_sub(buf.len());
            if chunk.len() > remaining {
                buf.extend_from_slice(&chunk[..remaining]);
                truncated = true;
                break;
            }
            buf.extend_from_slice(&chunk);
        }
        let elapsed = elapsed_ms(started);
        let size_bytes = buf.len() as u64;

        let (body, body_is_utf8) = match String::from_utf8(buf) {
            Ok(s) => (s, true),
            Err(e) => (String::from_utf8_lossy(e.as_bytes()).into_owned(), false),
        };

        Ok(ResponseData {
            status: status.as_u16(),
            status_text: status.canonical_reason().unwrap_or("").to_owned(),
            http_version,
            headers,
            body,
            body_is_utf8,
            size_bytes,
            truncated,
            ttfb_ms,
            elapsed_ms: elapsed,
            final_url,
        })
    }
}

fn elapsed_ms(started: Instant) -> u64 {
    u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX)
}

/// 入力された URL を解析する。スキームを省略した場合は補完する。
///
/// - `localhost`・ループバックアドレスは `http://`、それ以外は `https://` を補う
/// - `http` / `https` 以外のスキーム（`file:` `javascript:` など）は拒否する
pub fn normalize_url(input: &str) -> Result<Url, EngineError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(EngineError::EmptyUrl);
    }
    let candidate = if has_explicit_scheme(trimmed) {
        trimmed.to_owned()
    } else if is_local_host(trimmed) {
        format!("http://{trimmed}")
    } else {
        format!("https://{trimmed}")
    };
    let url = Url::parse(&candidate).map_err(|e| EngineError::InvalidUrl {
        detail: e.to_string(),
    })?;
    match url.scheme() {
        "http" | "https" => {}
        other => {
            return Err(EngineError::UnsupportedScheme {
                scheme: other.to_owned(),
            });
        }
    }
    if url.host_str().is_none_or(str::is_empty) {
        return Err(EngineError::InvalidUrl {
            detail: "host is empty".to_owned(),
        });
    }
    Ok(url)
}

/// `scheme:` で始まるかを判定する。`localhost:8080` のようにコロンの直後が数字なら
/// ポート番号とみなし、スキームとは扱わない。
fn has_explicit_scheme(s: &str) -> bool {
    let Some(colon) = s.find(':') else {
        return false;
    };
    let scheme = &s[..colon];
    let valid_scheme = scheme
        .chars()
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic())
        && scheme
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'));
    if !valid_scheme {
        return false;
    }
    !s[colon + 1..]
        .chars()
        .next()
        .is_some_and(|c| c.is_ascii_digit())
}

fn is_local_host(s: &str) -> bool {
    let lower = s.to_ascii_lowercase();
    let host = lower
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default()
        .rsplit('@')
        .next()
        .unwrap_or_default();
    let host = if host.starts_with('[') {
        host.split(']').next().map(|h| h.trim_start_matches('['))
    } else {
        host.split(':').next()
    }
    .unwrap_or_default();
    host == "localhost"
        || host.ends_with(".localhost")
        || host.starts_with("127.")
        || host == "0.0.0.0"
        || host == "::1"
}

/// URL に有効なクエリパラメーターを追加する。キーが空の行は無視する。
pub fn build_url(spec: &RequestSpec) -> Result<Url, EngineError> {
    let mut url = normalize_url(&spec.url)?;
    let params: Vec<&KeyValue> = spec
        .query
        .iter()
        .filter(|kv| kv.enabled && !kv.key.is_empty())
        .collect();
    if !params.is_empty() {
        let mut pairs = url.query_pairs_mut();
        for kv in params {
            pairs.append_pair(&kv.key, &kv.value);
        }
    }
    Ok(url)
}

/// 有効なヘッダー行から `HeaderMap` を作る。キーが空の行は無視する。
pub fn build_headers(rows: &[KeyValue]) -> Result<HeaderMap, EngineError> {
    let mut map = HeaderMap::new();
    for kv in rows.iter().filter(|kv| kv.enabled) {
        let name = kv.key.trim();
        if name.is_empty() {
            continue;
        }
        let header_name = HeaderName::from_bytes(name.as_bytes()).map_err(|_| {
            EngineError::InvalidHeaderName {
                name: name.to_owned(),
            }
        })?;
        let value =
            HeaderValue::from_str(&kv.value).map_err(|_| EngineError::InvalidHeaderValue {
                name: name.to_owned(),
            })?;
        map.append(header_name, value);
    }
    Ok(map)
}

fn to_method(m: HttpMethod) -> Method {
    match m {
        HttpMethod::Get => Method::GET,
        HttpMethod::Post => Method::POST,
        HttpMethod::Put => Method::PUT,
        HttpMethod::Patch => Method::PATCH,
        HttpMethod::Delete => Method::DELETE,
    }
}

/// `RequestSpec` から送信可能な `reqwest::Request` を組み立てる。
pub fn build_request(client: &Client, spec: &RequestSpec) -> Result<reqwest::Request, EngineError> {
    let url = build_url(spec)?;
    let mut headers = build_headers(&spec.headers)?;

    // 認証タブの設定がある場合は、手入力の Authorization ヘッダーより優先する。
    if !matches!(spec.auth, Auth::None) {
        headers.remove(AUTHORIZATION);
    }

    // 本文が空の場合は「ボディなし」と同じに扱い、Content-Type も付けない。
    let (body, default_content_type) = match &spec.body {
        Body::None => (None, None),
        Body::Json { text } | Body::Text { text } if text.is_empty() => (None, None),
        Body::Json { text } => (Some(text.clone()), Some("application/json")),
        Body::Text { text } => (Some(text.clone()), Some("text/plain; charset=utf-8")),
    };
    if let Some(ct) = default_content_type
        && !headers.contains_key(CONTENT_TYPE)
    {
        headers.insert(CONTENT_TYPE, HeaderValue::from_static(ct));
    }

    let mut builder = client.request(to_method(spec.method), url).headers(headers);
    builder = match &spec.auth {
        Auth::None => builder,
        Auth::Basic { username, password } => builder.basic_auth(username, Some(password)),
        Auth::Bearer { token } => {
            // bearer_auth は不正な文字を含むとパニックせずビルド時エラーになる。
            builder.bearer_auth(token)
        }
    };
    if let Some(body) = body {
        builder = builder.body(body);
    }
    builder.build().map_err(|e| {
        if e.is_builder() {
            EngineError::InvalidHeaderValue {
                name: AUTHORIZATION.as_str().to_owned(),
            }
        } else {
            EngineError::Other {
                detail: e.to_string(),
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(url: &str) -> RequestSpec {
        RequestSpec {
            url: url.to_owned(),
            ..Default::default()
        }
    }

    #[test]
    fn normalize_adds_scheme() {
        assert_eq!(
            normalize_url("example.com/a").unwrap().as_str(),
            "https://example.com/a"
        );
        assert_eq!(
            normalize_url("localhost:8080/x").unwrap().as_str(),
            "http://localhost:8080/x"
        );
        assert_eq!(
            normalize_url("127.0.0.1:3000").unwrap().as_str(),
            "http://127.0.0.1:3000/"
        );
        assert_eq!(
            normalize_url("[::1]:3000/a").unwrap().as_str(),
            "http://[::1]:3000/a"
        );
        assert_eq!(
            normalize_url("  http://example.com  ").unwrap().as_str(),
            "http://example.com/"
        );
    }

    #[test]
    fn normalize_rejects_bad_input() {
        assert_eq!(normalize_url("   "), Err(EngineError::EmptyUrl));
        assert!(matches!(
            normalize_url("file:///etc/passwd"),
            Err(EngineError::UnsupportedScheme { .. })
        ));
        assert!(matches!(
            normalize_url("javascript:alert(1)"),
            Err(EngineError::UnsupportedScheme { .. })
        ));
        assert!(matches!(
            normalize_url("ftp://example.com"),
            Err(EngineError::UnsupportedScheme { .. })
        ));
        assert!(matches!(
            normalize_url("http://exa mple.com"),
            Err(EngineError::InvalidUrl { .. })
        ));
        assert!(matches!(
            normalize_url("http://"),
            Err(EngineError::InvalidUrl { .. })
        ));
    }

    #[test]
    fn build_url_appends_enabled_params_only() {
        let mut s = spec("https://example.com/search?a=1");
        s.query = vec![
            KeyValue::new("q", "日本語 & space"),
            KeyValue {
                key: "off".into(),
                value: "x".into(),
                enabled: false,
            },
            KeyValue::new("", "ignored"),
        ];
        let url = build_url(&s).unwrap();
        assert_eq!(
            url.as_str(),
            "https://example.com/search?a=1&q=%E6%97%A5%E6%9C%AC%E8%AA%9E+%26+space"
        );
    }

    #[test]
    fn build_url_without_params_keeps_url() {
        let url = build_url(&spec("https://example.com/path")).unwrap();
        assert_eq!(url.as_str(), "https://example.com/path");
    }

    #[test]
    fn build_headers_validates() {
        let rows = vec![
            KeyValue::new("X-A", "1"),
            KeyValue::new("X-A", "2"),
            KeyValue::new("  ", "skip"),
            KeyValue {
                key: "X-Off".into(),
                value: "1".into(),
                enabled: false,
            },
        ];
        let map = build_headers(&rows).unwrap();
        assert_eq!(map.get_all("x-a").iter().count(), 2);
        assert!(!map.contains_key("x-off"));

        assert_eq!(
            build_headers(&[KeyValue::new("Bad Name", "v")]),
            Err(EngineError::InvalidHeaderName {
                name: "Bad Name".into()
            })
        );
        assert_eq!(
            build_headers(&[KeyValue::new("X-New", "a\nb")]),
            Err(EngineError::InvalidHeaderValue {
                name: "X-New".into()
            })
        );
    }

    #[test]
    fn build_request_sets_content_type_and_auth() {
        let client = Client::new();
        let mut s = spec("https://example.com");
        s.method = HttpMethod::Post;
        s.body = Body::Json {
            text: "{\"a\":1}".into(),
        };
        s.headers = vec![KeyValue::new("Authorization", "manual")];
        s.auth = Auth::Bearer {
            token: "dummy-token".into(),
        };
        let req = build_request(&client, &s).unwrap();
        assert_eq!(req.method(), Method::POST);
        assert_eq!(req.headers()[CONTENT_TYPE], "application/json");
        assert_eq!(req.headers()[AUTHORIZATION], "Bearer dummy-token");
        assert_eq!(req.headers().get_all(AUTHORIZATION).iter().count(), 1);
        assert!(req.headers()[AUTHORIZATION].is_sensitive());
    }

    #[test]
    fn manual_content_type_wins() {
        let client = Client::new();
        let mut s = spec("https://example.com");
        s.body = Body::Text { text: "x".into() };
        s.headers = vec![KeyValue::new("content-type", "application/xml")];
        let req = build_request(&client, &s).unwrap();
        assert_eq!(req.headers()[CONTENT_TYPE], "application/xml");
    }

    #[test]
    fn empty_body_sends_no_content_type() {
        let client = Client::new();
        let mut s = spec("https://example.com");
        s.body = Body::Json {
            text: String::new(),
        };
        let req = build_request(&client, &s).unwrap();
        assert!(!req.headers().contains_key(CONTENT_TYPE));
        assert!(req.body().is_none());
    }

    #[test]
    fn basic_auth_is_encoded() {
        let client = Client::new();
        let mut s = spec("https://example.com");
        s.auth = Auth::Basic {
            username: "user".into(),
            password: "pass".into(),
        };
        let req = build_request(&client, &s).unwrap();
        assert_eq!(req.headers()[AUTHORIZATION], "Basic dXNlcjpwYXNz");
    }

    #[test]
    fn invalid_bearer_token_is_error() {
        let client = Client::new();
        let mut s = spec("https://example.com");
        s.auth = Auth::Bearer {
            token: "a\nb".into(),
        };
        assert!(matches!(
            build_request(&client, &s),
            Err(EngineError::InvalidHeaderValue { .. })
        ));
    }
}
