//! curl コマンドの読み込み（インポート）と書き出し（エクスポート）。
//!
//! ブラウザの開発者ツールの「Copy as cURL」が出力する 2 つの形式に対応する。
//! - bash 形式：シングルクォート、`$'...'`、行末の `\` による改行
//! - cmd 形式（Windows）：`^"` による引用、`^` によるエスケープ、行末の `^` による改行
//!
//! 実際のシェルの完全な再現ではなく、curl コマンドとして現れる範囲を扱う。

use serde::Serialize;
use url::Url;

use crate::model::{Auth, Body, HttpMethod, KeyValue, RequestSpec};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, thiserror::Error)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CurlError {
    #[error("curl コマンドではありません")]
    NotCurl,
    #[error("引用符が閉じられていません")]
    UnterminatedQuote,
    #[error("オプションに値がありません: {option}")]
    MissingValue { option: String },
    #[error("URL がありません")]
    MissingUrl,
    #[error("URL を解析できません")]
    InvalidUrl,
    #[error("対応していない HTTP メソッドです: {method}")]
    UnsupportedMethod { method: String },
}

/// 読み込みはできたが、内容をそのまま再現できない点。UI で利用者に伝える。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CurlWarning {
    /// 未対応のオプション。無視した。
    UnknownOption { option: String },
    /// `-k` / `--insecure`。Reqit は TLS 証明書の検証を無効にしないため無視した。
    InsecureIgnored,
    /// ファイルから読み込む指定（`-d @file` など）。内容は取り込めない。
    FileReferenceIgnored { option: String },
    /// フォーム送信（`-F`）。現在は未対応のため無視した。
    MultipartIgnored,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedCurl {
    pub spec: RequestSpec,
    pub warnings: Vec<CurlWarning>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CurlStyle {
    Bash,
    Cmd,
}

// ---------------------------------------------------------------------------
// 字句解析
// ---------------------------------------------------------------------------

fn looks_like_cmd(input: &str) -> bool {
    input.contains("^\"") || input.lines().any(|l| l.trim_end().ends_with(" ^"))
}

/// bash 形式の字句解析。
fn split_bash(input: &str) -> Result<Vec<String>, CurlError> {
    let mut args = Vec::new();
    let mut cur = String::new();
    let mut has_token = false;
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            c if c.is_whitespace() => {
                if has_token {
                    args.push(std::mem::take(&mut cur));
                    has_token = false;
                }
            }
            '\\' => match chars.next() {
                // 行末の \ は改行の継続
                Some('\n') => {}
                Some('\r') => {
                    if chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                }
                Some(n) => {
                    cur.push(n);
                    has_token = true;
                }
                None => {}
            },
            '\'' => {
                has_token = true;
                loop {
                    match chars.next() {
                        Some('\'') => break,
                        Some(ch) => cur.push(ch),
                        None => return Err(CurlError::UnterminatedQuote),
                    }
                }
            }
            '"' => {
                has_token = true;
                loop {
                    match chars.next() {
                        Some('"') => break,
                        Some('\\') => match chars.next() {
                            Some(n @ ('$' | '`' | '"' | '\\')) => cur.push(n),
                            Some('\n') => {}
                            Some(n) => {
                                cur.push('\\');
                                cur.push(n);
                            }
                            None => return Err(CurlError::UnterminatedQuote),
                        },
                        Some(ch) => cur.push(ch),
                        None => return Err(CurlError::UnterminatedQuote),
                    }
                }
            }
            '$' if chars.peek() == Some(&'\'') => {
                chars.next();
                has_token = true;
                read_ansi_c(&mut chars, &mut cur)?;
            }
            _ => {
                cur.push(c);
                has_token = true;
            }
        }
    }
    if has_token {
        args.push(cur);
    }
    Ok(args)
}

/// `$'...'` の中身（ANSI-C 形式のエスケープ）を読む。
fn read_ansi_c(
    chars: &mut std::iter::Peekable<std::str::Chars<'_>>,
    out: &mut String,
) -> Result<(), CurlError> {
    loop {
        match chars.next() {
            Some('\'') => return Ok(()),
            Some('\\') => match chars.next() {
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some('r') => out.push('\r'),
                Some('0') => out.push('\0'),
                Some('x') => {
                    let hex: String = take_hex(chars, 2);
                    push_code(out, &hex);
                }
                Some('u') => {
                    let hex: String = take_hex(chars, 4);
                    push_code(out, &hex);
                }
                Some('U') => {
                    let hex: String = take_hex(chars, 8);
                    push_code(out, &hex);
                }
                Some(n) => out.push(n),
                None => return Err(CurlError::UnterminatedQuote),
            },
            Some(ch) => out.push(ch),
            None => return Err(CurlError::UnterminatedQuote),
        }
    }
}

fn take_hex(chars: &mut std::iter::Peekable<std::str::Chars<'_>>, max: usize) -> String {
    let mut s = String::new();
    while s.len() < max {
        match chars.peek() {
            Some(c) if c.is_ascii_hexdigit() => s.push(chars.next().unwrap_or_default()),
            _ => break,
        }
    }
    s
}

fn push_code(out: &mut String, hex: &str) {
    if let Some(c) = u32::from_str_radix(hex, 16).ok().and_then(char::from_u32) {
        out.push(c);
    }
}

/// cmd 形式の字句解析。
///
/// まず cmd のエスケープ（`^X` → `X`、行末の `^` + 改行 → 削除）を外し、
/// 残った文字列を Windows のコマンドライン規則（`"` で囲む、`\"` は文字の `"`）で分割する。
fn split_cmd(input: &str) -> Result<Vec<String>, CurlError> {
    let mut unescaped = String::new();
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '^' {
            match chars.next() {
                Some('\r') => {
                    if chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                }
                Some('\n') => {}
                Some(n) => unescaped.push(n),
                None => {}
            }
        } else {
            unescaped.push(c);
        }
    }

    let mut args = Vec::new();
    let mut cur = String::new();
    let mut has_token = false;
    let mut in_quote = false;
    let mut chars = unescaped.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                // 連続する \ の直後に " がある場合だけ、\ はエスケープとして働く。
                let mut n = 1;
                while chars.peek() == Some(&'\\') {
                    chars.next();
                    n += 1;
                }
                if chars.peek() == Some(&'"') {
                    cur.extend(std::iter::repeat_n('\\', n / 2));
                    if n % 2 == 1 {
                        chars.next();
                        cur.push('"');
                    }
                } else {
                    cur.extend(std::iter::repeat_n('\\', n));
                }
                has_token = true;
            }
            '"' => {
                in_quote = !in_quote;
                has_token = true;
            }
            c if c.is_whitespace() && !in_quote => {
                if has_token {
                    args.push(std::mem::take(&mut cur));
                    has_token = false;
                }
            }
            _ => {
                cur.push(c);
                has_token = true;
            }
        }
    }
    if in_quote {
        return Err(CurlError::UnterminatedQuote);
    }
    if has_token {
        args.push(cur);
    }
    Ok(args)
}

// ---------------------------------------------------------------------------
// 解釈
// ---------------------------------------------------------------------------

/// curl コマンドを読み込み、`RequestSpec` に変換する。
pub fn parse_curl(input: &str) -> Result<ParsedCurl, CurlError> {
    let args = if looks_like_cmd(input) {
        split_cmd(input)?
    } else {
        split_bash(input)?
    };
    let mut it = args.into_iter();
    match it.next().as_deref() {
        Some("curl") | Some("curl.exe") => {}
        _ => return Err(CurlError::NotCurl),
    }

    let mut warnings = Vec::new();
    let mut method: Option<String> = None;
    let mut url: Option<String> = None;
    let mut headers: Vec<KeyValue> = Vec::new();
    let mut data: Vec<String> = Vec::new();
    let mut user: Option<String> = None;
    let mut get_mode = false;
    let mut json_mode = false;

    let mut rest = it.peekable();
    while let Some(arg) = rest.next() {
        // --opt=value 形式に対応する
        let (opt, inline) = match arg.split_once('=') {
            Some((o, v)) if arg.starts_with("--") => (o.to_owned(), Some(v.to_owned())),
            _ => (arg.clone(), None),
        };
        let mut value = |name: &str| -> Result<String, CurlError> {
            if let Some(v) = inline.clone() {
                return Ok(v);
            }
            rest.next().ok_or(CurlError::MissingValue {
                option: name.to_owned(),
            })
        };

        match opt.as_str() {
            "-X" | "--request" => method = Some(value(&opt)?.to_ascii_uppercase()),
            "-H" | "--header" => {
                let h = value(&opt)?;
                if let Some((k, v)) = h.split_once(':') {
                    headers.push(KeyValue::new(k.trim(), v.trim_start()));
                } else if !h.trim().is_empty() {
                    // "Name;" は空の値のヘッダーを意味する
                    headers.push(KeyValue::new(h.trim().trim_end_matches(';'), ""));
                }
            }
            "-d" | "--data" | "--data-raw" | "--data-binary" | "--data-ascii"
            | "--data-urlencode" => {
                let v = value(&opt)?;
                if opt != "--data-raw" && v.starts_with('@') {
                    warnings.push(CurlWarning::FileReferenceIgnored { option: opt });
                } else {
                    data.push(v);
                }
            }
            "--json" => {
                let v = value(&opt)?;
                json_mode = true;
                if v.starts_with('@') {
                    warnings.push(CurlWarning::FileReferenceIgnored { option: opt });
                } else {
                    data.push(v);
                }
            }
            "-u" | "--user" => user = Some(value(&opt)?),
            "-b" | "--cookie" => {
                let v = value(&opt)?;
                if v.contains('=') {
                    headers.push(KeyValue::new("Cookie", v));
                } else {
                    warnings.push(CurlWarning::FileReferenceIgnored { option: opt });
                }
            }
            "-A" | "--user-agent" => headers.push(KeyValue::new("User-Agent", value(&opt)?)),
            "-e" | "--referer" => headers.push(KeyValue::new("Referer", value(&opt)?)),
            "--url" => url = Some(value(&opt)?),
            "-G" | "--get" => get_mode = true,
            "-k" | "--insecure" => warnings.push(CurlWarning::InsecureIgnored),
            "-F" | "--form" | "--form-string" => {
                value(&opt)?;
                warnings.push(CurlWarning::MultipartIgnored);
            }
            // 結果に影響しない、または Reqit の既定の動作と同じオプション
            "--compressed" | "-L" | "--location" | "-s" | "--silent" | "-S" | "--show-error"
            | "-v" | "--verbose" | "-i" | "--include" | "-g" | "--globoff" | "--http1.1"
            | "--http2" | "-f" | "--fail" => {}
            "-o" | "--output" | "-m" | "--max-time" | "--connect-timeout" => {
                value(&opt)?;
            }
            s if s.starts_with('-') && s.len() > 1 => {
                warnings.push(CurlWarning::UnknownOption {
                    option: s.to_owned(),
                });
            }
            _ => {
                if url.is_none() {
                    url = Some(arg);
                }
            }
        }
    }

    let raw_url = url.ok_or(CurlError::MissingUrl)?;
    let mut parsed = Url::parse(&raw_url)
        .or_else(|_| Url::parse(&format!("http://{raw_url}")))
        .map_err(|_| CurlError::InvalidUrl)?;

    let mut query: Vec<KeyValue> = parsed
        .query_pairs()
        .map(|(k, v)| KeyValue::new(k.into_owned(), v.into_owned()))
        .collect();
    parsed.set_query(None);
    parsed.set_fragment(None);

    let data_joined = (!data.is_empty()).then(|| data.join("&"));
    let mut body_text = None;
    if get_mode {
        if let Some(d) = &data_joined {
            for (k, v) in url::form_urlencoded::parse(d.as_bytes()) {
                query.push(KeyValue::new(k.into_owned(), v.into_owned()));
            }
        }
    } else {
        body_text = data_joined;
    }

    let method_str =
        method.unwrap_or_else(|| if body_text.is_some() { "POST" } else { "GET" }.to_owned());
    let method = match method_str.as_str() {
        "GET" => HttpMethod::Get,
        "POST" => HttpMethod::Post,
        "PUT" => HttpMethod::Put,
        "PATCH" => HttpMethod::Patch,
        "DELETE" => HttpMethod::Delete,
        other => {
            return Err(CurlError::UnsupportedMethod {
                method: other.to_owned(),
            });
        }
    };

    if json_mode {
        if !has_header(&headers, "content-type") {
            headers.push(KeyValue::new("Content-Type", "application/json"));
        }
        if !has_header(&headers, "accept") {
            headers.push(KeyValue::new("Accept", "application/json"));
        }
    }

    let body = match body_text {
        None => Body::None,
        Some(text) => {
            let ct_json = headers.iter().any(|h| {
                h.key.eq_ignore_ascii_case("content-type")
                    && h.value.to_ascii_lowercase().contains("json")
            });
            if ct_json || serde_json::from_str::<serde_json::Value>(&text).is_ok() {
                Body::Json { text }
            } else {
                Body::Text { text }
            }
        }
    };

    let auth = match user {
        Some(u) => {
            let (username, password) = u.split_once(':').unwrap_or((&u, ""));
            Auth::Basic {
                username: username.to_owned(),
                password: password.to_owned(),
            }
        }
        None => Auth::None,
    };

    Ok(ParsedCurl {
        spec: RequestSpec {
            method,
            url: parsed.to_string(),
            query,
            headers,
            body,
            auth,
            ..Default::default()
        },
        warnings,
    })
}

fn has_header(headers: &[KeyValue], name: &str) -> bool {
    headers.iter().any(|h| h.key.eq_ignore_ascii_case(name))
}

// ---------------------------------------------------------------------------
// 書き出し
// ---------------------------------------------------------------------------

fn quote_bash(s: &str) -> String {
    if s.contains(['\n', '\r', '\t']) {
        // 改行などを含む場合は $'...' で表す
        let mut out = String::from("$'");
        for c in s.chars() {
            match c {
                '\\' => out.push_str("\\\\"),
                '\'' => out.push_str("\\'"),
                '\n' => out.push_str("\\n"),
                '\r' => out.push_str("\\r"),
                '\t' => out.push_str("\\t"),
                c => out.push(c),
            }
        }
        out.push('\'');
        out
    } else {
        format!("'{}'", s.replace('\'', "'\\''"))
    }
}

/// cmd 形式の引用。Windows のコマンドライン規則で `"` を `\"` にしたうえで、
/// cmd が解釈する特殊文字に `^` を付ける。
fn quote_cmd(s: &str) -> String {
    let mut inner = String::new();
    let mut backslashes = 0;
    for c in s.chars() {
        match c {
            '\\' => backslashes += 1,
            '"' => {
                inner.extend(std::iter::repeat_n('\\', backslashes * 2 + 1));
                inner.push('"');
                backslashes = 0;
                continue;
            }
            _ => {}
        }
        if c != '\\' {
            inner.extend(std::iter::repeat_n('\\', backslashes));
            backslashes = 0;
            inner.push(c);
        }
    }
    inner.extend(std::iter::repeat_n('\\', backslashes * 2));

    let mut out = String::from("^\"");
    for c in inner.chars() {
        match c {
            '"' | '^' | '&' | '|' | '<' | '>' | '%' | '!' | '(' | ')' => {
                out.push('^');
                out.push(c);
            }
            '\n' => out.push_str("^\n\n"),
            '\r' => {}
            c => out.push(c),
        }
    }
    out.push_str("^\"");
    out
}

/// `RequestSpec` を curl コマンドに変換する。無効化した行と空のキーは含めない。
pub fn to_curl(spec: &RequestSpec, style: CurlStyle) -> String {
    let q = |s: &str| match style {
        CurlStyle::Bash => quote_bash(s),
        CurlStyle::Cmd => quote_cmd(s),
    };
    let cont = match style {
        CurlStyle::Bash => " \\\n  ",
        CurlStyle::Cmd => " ^\n  ",
    };

    let url = crate::engine::build_url(spec)
        .map(|u| u.to_string())
        .unwrap_or_else(|_| spec.url.clone());

    let mut parts = vec![format!("curl {}", q(&url))];
    let has_body = !matches!(&spec.body, Body::None)
        && !matches!(&spec.body, Body::Json { text } | Body::Text { text } if text.is_empty());
    let implied = if has_body {
        HttpMethod::Post
    } else {
        HttpMethod::Get
    };
    if spec.method != implied {
        parts.push(format!("-X {}", spec.method.as_str()));
    }
    for h in spec
        .headers
        .iter()
        .filter(|h| h.enabled && !h.key.trim().is_empty())
    {
        parts.push(format!(
            "-H {}",
            q(&format!("{}: {}", h.key.trim(), h.value))
        ));
    }
    match &spec.auth {
        Auth::None => {}
        Auth::Basic { username, password } => {
            parts.push(format!("-u {}", q(&format!("{username}:{password}"))));
        }
        Auth::Bearer { token } => {
            parts.push(format!(
                "-H {}",
                q(&format!("Authorization: Bearer {token}"))
            ));
        }
    }
    if has_body {
        let (text, default_ct) = match &spec.body {
            Body::Json { text } => (text, "application/json"),
            Body::Text { text } => (text, "text/plain; charset=utf-8"),
            Body::None => unreachable!(),
        };
        if !has_header(&spec.headers, "content-type") {
            parts.push(format!("-H {}", q(&format!("Content-Type: {default_ct}"))));
        }
        parts.push(format!("--data-raw {}", q(text)));
    }
    parts.join(cont)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(s: &str) -> ParsedCurl {
        parse_curl(s).unwrap()
    }

    #[test]
    fn simple_get() {
        let p = parse("curl https://api.example.com/users?page=2&q=a%20b");
        assert_eq!(p.spec.method, HttpMethod::Get);
        assert_eq!(p.spec.url, "https://api.example.com/users");
        assert_eq!(
            p.spec.query,
            vec![KeyValue::new("page", "2"), KeyValue::new("q", "a b")]
        );
        assert!(p.warnings.is_empty());
    }

    #[test]
    fn chrome_bash_format() {
        let input = r#"curl 'https://api.example.com/items' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'cookie: sid=dummy-session' \
  --data-raw $'{"name":"It\'s","note":"a\nb"}' \
  --compressed"#;
        let p = parse(input);
        assert_eq!(p.spec.method, HttpMethod::Post);
        assert_eq!(p.spec.url, "https://api.example.com/items");
        assert_eq!(p.spec.headers.len(), 3);
        assert_eq!(
            p.spec.headers[2],
            KeyValue::new("cookie", "sid=dummy-session")
        );
        assert_eq!(
            p.spec.body,
            Body::Json {
                text: "{\"name\":\"It's\",\"note\":\"a\nb\"}".into()
            }
        );
        assert!(p.warnings.is_empty());
    }

    #[test]
    fn chrome_cmd_format() {
        let input = "curl ^\"https://api.example.com/items?x=1^&y=2^\" ^\n  -H ^\"accept: */*^\" ^\n  -H ^\"content-type: application/json^\" ^\n  --data-raw ^\"^{^\\^\"name^\\^\":^\\^\"a b^\\^\"^}^\"";
        let p = parse(input);
        assert_eq!(p.spec.method, HttpMethod::Post);
        assert_eq!(p.spec.url, "https://api.example.com/items");
        assert_eq!(
            p.spec.query,
            vec![KeyValue::new("x", "1"), KeyValue::new("y", "2")]
        );
        assert_eq!(p.spec.headers[0], KeyValue::new("accept", "*/*"));
        assert_eq!(
            p.spec.body,
            Body::Json {
                text: r#"{"name":"a b"}"#.into()
            }
        );
    }

    #[test]
    fn options_and_auth() {
        let p = parse(
            "curl -X put -u alice:dummy-pass -A Reqit -e https://example.com/ --url=https://example.com/a -d 'x=1'",
        );
        assert_eq!(p.spec.method, HttpMethod::Put);
        assert_eq!(
            p.spec.auth,
            Auth::Basic {
                username: "alice".into(),
                password: "dummy-pass".into()
            }
        );
        assert_eq!(p.spec.headers[0], KeyValue::new("User-Agent", "Reqit"));
        assert_eq!(
            p.spec.headers[1],
            KeyValue::new("Referer", "https://example.com/")
        );
        assert_eq!(p.spec.body, Body::Text { text: "x=1".into() });
    }

    #[test]
    fn get_mode_moves_data_to_query() {
        let p = parse("curl -G https://example.com/search -d q=hello%20world -d page=2");
        assert_eq!(p.spec.method, HttpMethod::Get);
        assert_eq!(p.spec.body, Body::None);
        assert_eq!(
            p.spec.query,
            vec![
                KeyValue::new("q", "hello world"),
                KeyValue::new("page", "2")
            ]
        );
    }

    #[test]
    fn json_option_sets_headers() {
        let p = parse(r#"curl --json '{"a":1}' https://example.com"#);
        assert_eq!(p.spec.method, HttpMethod::Post);
        assert!(has_header(&p.spec.headers, "content-type"));
        assert!(matches!(p.spec.body, Body::Json { .. }));
    }

    #[test]
    fn warnings_are_reported() {
        let p = parse("curl -k --foo -F file=@a.png -d @body.json https://example.com");
        assert_eq!(
            p.warnings,
            vec![
                CurlWarning::InsecureIgnored,
                CurlWarning::UnknownOption {
                    option: "--foo".into()
                },
                CurlWarning::MultipartIgnored,
                CurlWarning::FileReferenceIgnored {
                    option: "-d".into()
                },
            ]
        );
    }

    #[test]
    fn errors() {
        assert_eq!(
            parse_curl("wget https://example.com"),
            Err(CurlError::NotCurl)
        );
        assert_eq!(parse_curl("curl -H 'x: y'"), Err(CurlError::MissingUrl));
        assert_eq!(
            parse_curl("curl 'https://example.com"),
            Err(CurlError::UnterminatedQuote)
        );
        assert_eq!(
            parse_curl("curl -H"),
            Err(CurlError::MissingValue {
                option: "-H".into()
            })
        );
        assert_eq!(
            parse_curl("curl -X HEAD https://example.com"),
            Err(CurlError::UnsupportedMethod {
                method: "HEAD".into()
            })
        );
    }

    fn sample_spec() -> RequestSpec {
        RequestSpec {
            method: HttpMethod::Post,
            url: "https://api.example.com/items".into(),
            query: vec![
                KeyValue::new("lang", "ja"),
                KeyValue {
                    key: "off".into(),
                    value: "1".into(),
                    enabled: false,
                },
            ],
            headers: vec![KeyValue::new("X-Note", "it's \"quoted\" & 100%")],
            body: Body::Json {
                text: "{\"name\":\"テスト\",\"memo\":\"a\nb\"}".into(),
            },
            auth: Auth::Bearer {
                token: "dummy-token".into(),
            },
            ..Default::default()
        }
    }

    #[test]
    fn export_then_import_roundtrip_bash() {
        let spec = sample_spec();
        let cmd = to_curl(&spec, CurlStyle::Bash);
        assert!(cmd.starts_with("curl 'https://api.example.com/items?lang=ja'"));
        assert!(!cmd.contains("off=1"));
        let back = parse(&cmd).spec;
        assert_eq!(back.method, HttpMethod::Post);
        assert_eq!(back.url, "https://api.example.com/items");
        assert_eq!(back.query, vec![KeyValue::new("lang", "ja")]);
        assert_eq!(back.body, spec.body);
        assert!(
            back.headers
                .contains(&KeyValue::new("X-Note", "it's \"quoted\" & 100%"))
        );
        assert!(
            back.headers
                .contains(&KeyValue::new("Authorization", "Bearer dummy-token"))
        );
    }

    #[test]
    fn export_then_import_roundtrip_cmd() {
        let spec = sample_spec();
        let cmd = to_curl(&spec, CurlStyle::Cmd);
        assert!(cmd.contains("^\""));
        let back = parse(&cmd).spec;
        assert_eq!(back.url, "https://api.example.com/items");
        assert_eq!(back.query, vec![KeyValue::new("lang", "ja")]);
        assert!(
            back.headers
                .contains(&KeyValue::new("X-Note", "it's \"quoted\" & 100%"))
        );
        // cmd 形式では、本文の改行を「^ + 改行 + 改行」で表し、読み込むと元に戻る
        assert_eq!(back.body, spec.body);
    }

    #[test]
    fn export_get_without_body() {
        let spec = RequestSpec {
            url: "https://example.com/".into(),
            ..Default::default()
        };
        assert_eq!(
            to_curl(&spec, CurlStyle::Bash),
            "curl 'https://example.com/'"
        );
        let del = RequestSpec {
            method: HttpMethod::Delete,
            url: "https://example.com/a".into(),
            ..Default::default()
        };
        assert_eq!(
            to_curl(&del, CurlStyle::Bash),
            "curl 'https://example.com/a' \\\n  -X DELETE"
        );
    }
}
