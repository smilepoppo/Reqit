//! 秘密情報の分離とマスク。
//!
//! リクエストを保存・表示するときに、認証情報や秘密情報らしい値を平文で残さないための処理。
//! 判定は名前ベースのため完全ではない。迷う場合は秘密情報として扱う方針にしている。

use serde::{Deserialize, Serialize};
use url::Url;

use crate::model::{Auth, KeyValue, RequestSpec};

/// マスク後の表示に使う文字列。
pub const MASK: &str = "********";

/// 値を秘密情報として扱うヘッダー名・クエリ名（小文字で比較）。
const SENSITIVE_EXACT: &[&str] = &[
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "key",
    "code",
    "sig",
    "signature",
    "pass",
    "pwd",
];

/// 名前に含まれていたら秘密情報として扱う語（小文字、区切り文字を除去して比較）。
const SENSITIVE_PARTS: &[&str] = &[
    "token",
    "secret",
    "password",
    "passwd",
    "apikey",
    "accesskey",
    "privatekey",
    "session",
    "credential",
    "auth",
    "csrf",
    "xsrf",
    "signature",
];

/// ヘッダー名やクエリ名が秘密情報を表すかを判定する。
pub fn is_sensitive_name(name: &str) -> bool {
    let lower = name.trim().to_ascii_lowercase();
    if SENSITIVE_EXACT.contains(&lower.as_str()) {
        return true;
    }
    let compact: String = lower
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    SENSITIVE_PARTS.iter().any(|p| compact.contains(p))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SecretLocation {
    Header,
    Query,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretField {
    pub location: SecretLocation,
    pub index: usize,
    /// 復元時に行の対応を確かめるための名前。
    pub name: String,
    pub value: String,
}

/// リクエストから分離した秘密情報。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretBundle {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url_password: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<SecretField>,
}

impl SecretBundle {
    pub fn is_empty(&self) -> bool {
        self.auth_password.is_none()
            && self.auth_token.is_none()
            && self.url_password.is_none()
            && self.fields.is_empty()
    }
}

/// 秘密情報を取り除いたリクエストと、取り除いた値を返す。
///
/// 取り除いた箇所は空文字になる。行の数や順序は変えない。
pub fn split_secrets(spec: &RequestSpec) -> (RequestSpec, SecretBundle) {
    let mut clean = spec.clone();
    let mut bundle = SecretBundle::default();

    match &mut clean.auth {
        Auth::None => {}
        Auth::Basic { password, .. } => {
            if !password.is_empty() {
                bundle.auth_password = Some(std::mem::take(password));
            }
        }
        Auth::Bearer { token } => {
            if !token.is_empty() {
                bundle.auth_token = Some(std::mem::take(token));
            }
        }
    }

    if let Ok(mut url) = Url::parse(&clean.url)
        && let Some(pw) = url.password().map(str::to_owned)
        && url.set_password(None).is_ok()
    {
        bundle.url_password = Some(pw);
        clean.url = url.to_string();
    }

    take_fields(&mut clean.headers, SecretLocation::Header, &mut bundle);
    take_fields(&mut clean.query, SecretLocation::Query, &mut bundle);

    (clean, bundle)
}

fn take_fields(rows: &mut [KeyValue], location: SecretLocation, bundle: &mut SecretBundle) {
    for (index, kv) in rows.iter_mut().enumerate() {
        if !kv.value.is_empty() && is_sensitive_name(&kv.key) {
            bundle.fields.push(SecretField {
                location,
                index,
                name: kv.key.clone(),
                value: std::mem::take(&mut kv.value),
            });
        }
    }
}

/// `split_secrets` で取り除いた値を戻す。行の名前が一致しない値は捨てる。
pub fn merge_secrets(mut spec: RequestSpec, bundle: SecretBundle) -> RequestSpec {
    match &mut spec.auth {
        Auth::None => {}
        Auth::Basic { password, .. } => {
            if let Some(p) = bundle.auth_password {
                *password = p;
            }
        }
        Auth::Bearer { token } => {
            if let Some(t) = bundle.auth_token {
                *token = t;
            }
        }
    }
    if let Some(pw) = bundle.url_password
        && let Ok(mut url) = Url::parse(&spec.url)
        && !url.username().is_empty()
        && url.set_password(Some(&pw)).is_ok()
    {
        spec.url = url.to_string();
    }
    for field in bundle.fields {
        let rows = match field.location {
            SecretLocation::Header => &mut spec.headers,
            SecretLocation::Query => &mut spec.query,
        };
        if let Some(row) = rows.get_mut(field.index)
            && row.key == field.name
            && row.value.is_empty()
        {
            row.value = field.value;
        }
    }
    spec
}

/// ログやエクスポート用に、秘密情報を `MASK` に置き換えたリクエストを返す。
pub fn redact_spec(spec: &RequestSpec) -> RequestSpec {
    let (mut clean, bundle) = split_secrets(spec);
    if bundle.auth_password.is_some()
        && let Auth::Basic { password, .. } = &mut clean.auth
    {
        *password = MASK.to_owned();
    }
    if bundle.auth_token.is_some()
        && let Auth::Bearer { token } = &mut clean.auth
    {
        *token = MASK.to_owned();
    }
    if bundle.url_password.is_some()
        && let Ok(mut url) = Url::parse(&clean.url)
        && url.set_password(Some(MASK)).is_ok()
    {
        clean.url = url.to_string();
    }
    for field in &bundle.fields {
        let rows = match field.location {
            SecretLocation::Header => &mut clean.headers,
            SecretLocation::Query => &mut clean.query,
        };
        if let Some(row) = rows.get_mut(field.index) {
            row.value = MASK.to_owned();
        }
    }
    clean.url = redact_url(&clean.url);
    clean
}

/// URL のパスワードと、秘密情報らしいクエリ値をマスクする。解析できない URL はそのまま返す。
pub fn redact_url(input: &str) -> String {
    let Ok(mut url) = Url::parse(input) else {
        return input.to_owned();
    };
    if url.password().is_some() {
        let _ = url.set_password(Some(MASK));
    }
    if url.query().is_some() {
        let pairs: Vec<(String, String)> = url
            .query_pairs()
            .map(|(k, v)| {
                let v = if is_sensitive_name(&k) {
                    MASK.to_owned()
                } else {
                    v.into_owned()
                };
                (k.into_owned(), v)
            })
            .collect();
        if pairs.iter().any(|(_, v)| v == MASK) {
            url.query_pairs_mut().clear().extend_pairs(pairs);
        }
    }
    url.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Body;

    fn sample() -> RequestSpec {
        RequestSpec {
            url: "https://user:dummy-pass@example.com/api?x=1".into(),
            headers: vec![
                KeyValue::new("Accept", "application/json"),
                KeyValue::new("X-API-Key", "dummy-key-123"),
                KeyValue::new("Cookie", "sid=dummy-session"),
            ],
            query: vec![
                KeyValue::new("page", "2"),
                KeyValue::new("access_token", "dummy-token-abc"),
            ],
            auth: Auth::Bearer {
                token: "dummy-bearer".into(),
            },
            body: Body::Json { text: "{}".into() },
            ..Default::default()
        }
    }

    #[test]
    fn sensitive_names() {
        for n in [
            "Authorization",
            "X-API-Key",
            "api_key",
            "apiKey",
            "access_token",
            "Cookie",
            "X-CSRF-Token",
            "client_secret",
            "password",
            "key",
        ] {
            assert!(is_sensitive_name(n), "{n}");
        }
        for n in [
            "Accept",
            "Content-Type",
            "page",
            "q",
            "monkey",
            "User-Agent",
        ] {
            assert!(!is_sensitive_name(n), "{n}");
        }
    }

    #[test]
    fn split_removes_all_secrets() {
        let (clean, bundle) = split_secrets(&sample());
        let json = serde_json::to_string(&clean).unwrap();
        for secret in [
            "dummy-pass",
            "dummy-key-123",
            "dummy-session",
            "dummy-token-abc",
            "dummy-bearer",
        ] {
            assert!(!json.contains(secret), "{secret} leaked: {json}");
        }
        assert_eq!(clean.headers[0].value, "application/json");
        assert_eq!(clean.query[0].value, "2");
        assert_eq!(bundle.fields.len(), 3);
        assert!(!bundle.is_empty());
    }

    #[test]
    fn split_then_merge_roundtrip() {
        let original = sample();
        let (clean, bundle) = split_secrets(&original);
        assert_eq!(merge_secrets(clean, bundle), original);
    }

    #[test]
    fn merge_ignores_mismatched_rows() {
        let (mut clean, bundle) = split_secrets(&sample());
        clean.headers[1].key = "X-Other".into();
        let merged = merge_secrets(clean, bundle);
        assert_eq!(merged.headers[1].value, "");
    }

    #[test]
    fn redact_masks_values() {
        let r = redact_spec(&sample());
        assert_eq!(r.auth, Auth::Bearer { token: MASK.into() });
        assert_eq!(r.headers[1].value, MASK);
        assert_eq!(r.query[1].value, MASK);
        assert!(r.url.contains(MASK));
        assert!(!r.url.contains("dummy-pass"));
    }

    #[test]
    fn redact_url_masks_sensitive_query() {
        let u = redact_url("https://example.com/cb?code=dummy-code&state=ok&api_key=dummy-k");
        assert!(!u.contains("dummy-code"));
        assert!(!u.contains("dummy-k"));
        assert!(u.contains("state=ok"));
        assert_eq!(redact_url("not a url"), "not a url");
        assert_eq!(
            redact_url("https://example.com/?a=1"),
            "https://example.com/?a=1"
        );
    }
}
