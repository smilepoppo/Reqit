//! ローカルのモック HTTP サーバーを使った Request Engine の結合テスト。
//! 外部ネットワークには接続しない。

use std::time::Duration;

use reqit_core::{
    Auth, Body, CancellationToken, Engine, EngineConfig, EngineError, HttpMethod, KeyValue,
    RequestSpec,
};
use wiremock::matchers::{body_string, header, header_exists, method, path, query_param};
use wiremock::{Mock, MockServer, Request, ResponseTemplate};

fn engine() -> Engine {
    Engine::new(EngineConfig::default()).unwrap()
}

fn spec(method: HttpMethod, url: String) -> RequestSpec {
    RequestSpec {
        method,
        url,
        ..Default::default()
    }
}

#[tokio::test]
async fn sends_each_method_with_headers_and_body() {
    let server = MockServer::start().await;
    for m in ["GET", "POST", "PUT", "PATCH", "DELETE"] {
        Mock::given(method(m))
            .and(path("/items"))
            .and(header("x-test", "yes"))
            .respond_with(ResponseTemplate::new(200).set_body_string(m))
            .mount(&server)
            .await;
    }
    for (m, expected) in [
        (HttpMethod::Get, "GET"),
        (HttpMethod::Post, "POST"),
        (HttpMethod::Put, "PUT"),
        (HttpMethod::Patch, "PATCH"),
        (HttpMethod::Delete, "DELETE"),
    ] {
        let mut s = spec(m, format!("{}/items", server.uri()));
        s.headers = vec![KeyValue::new("X-Test", "yes")];
        let res = engine().send(&s, &CancellationToken::new()).await.unwrap();
        assert_eq!(res.status, 200, "{expected}");
        assert_eq!(res.body, expected);
    }
}

#[tokio::test]
async fn json_body_and_query_params_are_sent() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/users"))
        .and(query_param("lang", "ja"))
        .and(header("content-type", "application/json"))
        .and(body_string(r#"{"name":"テスト"}"#))
        .respond_with(ResponseTemplate::new(201).set_body_raw(r#"{"id":1}"#, "application/json"))
        .mount(&server)
        .await;

    let mut s = spec(HttpMethod::Post, format!("{}/users", server.uri()));
    s.query = vec![KeyValue::new("lang", "ja")];
    s.body = Body::Json {
        text: r#"{"name":"テスト"}"#.into(),
    };
    let res = engine().send(&s, &CancellationToken::new()).await.unwrap();
    assert_eq!(res.status, 201);
    assert_eq!(res.status_text, "Created");
    assert_eq!(res.body, r#"{"id":1}"#);
    assert_eq!(res.size_bytes, 8);
    assert!(
        res.headers
            .iter()
            .any(|(k, v)| k == "content-type" && v == "application/json")
    );
    assert_eq!(res.http_version, "HTTP/1.1");
    assert!(res.elapsed_ms >= res.ttfb_ms);
}

#[tokio::test]
async fn bearer_and_basic_auth_headers() {
    let server = MockServer::start().await;
    Mock::given(path("/bearer"))
        .and(header("authorization", "Bearer dummy-token"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&server)
        .await;
    Mock::given(path("/basic"))
        .and(header("authorization", "Basic dXNlcjpwYXNz"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&server)
        .await;

    let mut s = spec(HttpMethod::Get, format!("{}/bearer", server.uri()));
    s.auth = Auth::Bearer {
        token: "dummy-token".into(),
    };
    assert_eq!(
        engine()
            .send(&s, &CancellationToken::new())
            .await
            .unwrap()
            .status,
        200
    );

    let mut s = spec(HttpMethod::Get, format!("{}/basic", server.uri()));
    s.auth = Auth::Basic {
        username: "user".into(),
        password: "pass".into(),
    };
    assert_eq!(
        engine()
            .send(&s, &CancellationToken::new())
            .await
            .unwrap()
            .status,
        200
    );
}

#[tokio::test]
async fn http_error_status_is_a_response_not_an_error() {
    let server = MockServer::start().await;
    Mock::given(path("/missing"))
        .respond_with(ResponseTemplate::new(404).set_body_string("nope"))
        .mount(&server)
        .await;
    Mock::given(path("/boom"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&server)
        .await;

    let e = engine();
    let r = e
        .send(
            &spec(HttpMethod::Get, format!("{}/missing", server.uri())),
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!((r.status, r.status_text.as_str()), (404, "Not Found"));
    let r = e
        .send(
            &spec(HttpMethod::Get, format!("{}/boom", server.uri())),
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(r.status, 503);
}

#[tokio::test]
async fn timeout_is_reported() {
    let server = MockServer::start().await;
    Mock::given(path("/slow"))
        .respond_with(ResponseTemplate::new(200).set_delay(Duration::from_secs(5)))
        .mount(&server)
        .await;
    let mut s = spec(HttpMethod::Get, format!("{}/slow", server.uri()));
    s.timeout_ms = 200;
    let err = engine()
        .send(&s, &CancellationToken::new())
        .await
        .unwrap_err();
    assert_eq!(err, EngineError::Timeout { timeout_ms: 200 });
}

#[tokio::test]
async fn cancel_stops_inflight_request() {
    let server = MockServer::start().await;
    Mock::given(path("/slow"))
        .respond_with(ResponseTemplate::new(200).set_delay(Duration::from_secs(10)))
        .mount(&server)
        .await;
    let s = spec(HttpMethod::Get, format!("{}/slow", server.uri()));
    let token = CancellationToken::new();
    let t2 = token.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(100)).await;
        t2.cancel();
    });
    let started = std::time::Instant::now();
    let err = engine().send(&s, &token).await.unwrap_err();
    assert_eq!(err, EngineError::Cancelled);
    assert!(started.elapsed() < Duration::from_secs(3));
}

#[tokio::test]
async fn connection_refused_is_connect_error() {
    // 一時的にポートを確保してすぐ閉じ、接続を拒否されるポートを得る。
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let err = engine()
        .send(
            &spec(HttpMethod::Get, format!("http://127.0.0.1:{port}/")),
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
    assert!(matches!(err, EngineError::Connect { .. }), "{err:?}");
}

#[tokio::test]
async fn large_body_is_truncated() {
    let server = MockServer::start().await;
    Mock::given(path("/big"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(vec![b'a'; 100_000]))
        .mount(&server)
        .await;
    let e = Engine::new(EngineConfig {
        max_body_bytes: 1024,
        ..Default::default()
    })
    .unwrap();
    let r = e
        .send(
            &spec(HttpMethod::Get, format!("{}/big", server.uri())),
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert!(r.truncated);
    assert_eq!(r.size_bytes, 1024);
    assert_eq!(r.body.len(), 1024);
}

#[tokio::test]
async fn binary_body_is_flagged() {
    let server = MockServer::start().await;
    Mock::given(path("/bin"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(vec![0xff, 0xfe, 0x00, 0x80]))
        .mount(&server)
        .await;
    let r = engine()
        .send(
            &spec(HttpMethod::Get, format!("{}/bin", server.uri())),
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert!(!r.body_is_utf8);
    assert_eq!(r.size_bytes, 4);
}

#[tokio::test]
async fn invalid_json_is_returned_as_is() {
    let server = MockServer::start().await;
    Mock::given(path("/bad-json"))
        .respond_with(ResponseTemplate::new(200).set_body_raw("{not json", "application/json"))
        .mount(&server)
        .await;
    let r = engine()
        .send(
            &spec(HttpMethod::Get, format!("{}/bad-json", server.uri())),
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(r.body, "{not json");
}

#[tokio::test]
async fn cross_origin_redirect_drops_authorization() {
    let target = MockServer::start().await;
    let origin = MockServer::start().await;

    // 別オリジン（別ポート）へリダイレクトされたとき、Authorization が付いていたら 500 を返す。
    Mock::given(path("/landing"))
        .and(header_exists("authorization"))
        .respond_with(ResponseTemplate::new(500).set_body_string("leaked"))
        .with_priority(1)
        .mount(&target)
        .await;
    Mock::given(path("/landing"))
        .respond_with(ResponseTemplate::new(200).set_body_string("clean"))
        .with_priority(2)
        .mount(&target)
        .await;
    Mock::given(path("/start"))
        .respond_with(
            ResponseTemplate::new(302)
                .insert_header("location", format!("{}/landing", target.uri()).as_str()),
        )
        .mount(&origin)
        .await;

    let mut s = spec(HttpMethod::Get, format!("{}/start", origin.uri()));
    s.auth = Auth::Bearer {
        token: "dummy-token".into(),
    };
    let r = engine().send(&s, &CancellationToken::new()).await.unwrap();
    assert_eq!(r.body, "clean");
    assert_eq!(r.final_url, format!("{}/landing", target.uri()));
}

#[tokio::test]
async fn same_origin_redirect_keeps_authorization() {
    let server = MockServer::start().await;
    Mock::given(path("/start"))
        .respond_with(ResponseTemplate::new(302).insert_header("location", "/next"))
        .mount(&server)
        .await;
    Mock::given(path("/next"))
        .and(header("authorization", "Bearer dummy-token"))
        .respond_with(ResponseTemplate::new(200).set_body_string("ok"))
        .mount(&server)
        .await;
    let mut s = spec(HttpMethod::Get, format!("{}/start", server.uri()));
    s.auth = Auth::Bearer {
        token: "dummy-token".into(),
    };
    let r = engine().send(&s, &CancellationToken::new()).await.unwrap();
    assert_eq!(r.body, "ok");
}

#[tokio::test]
async fn redirect_loop_is_reported() {
    let server = MockServer::start().await;
    Mock::given(path("/loop"))
        .respond_with(ResponseTemplate::new(302).insert_header("location", "/loop"))
        .mount(&server)
        .await;
    let err = engine()
        .send(
            &spec(HttpMethod::Get, format!("{}/loop", server.uri())),
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
    assert_eq!(err, EngineError::TooManyRedirects);
}

#[tokio::test]
async fn invalid_inputs_fail_before_sending() {
    let e = engine();
    let t = CancellationToken::new();
    assert_eq!(
        e.send(&spec(HttpMethod::Get, "".into()), &t).await,
        Err(EngineError::EmptyUrl)
    );
    assert!(matches!(
        e.send(&spec(HttpMethod::Get, "file:///c:/windows".into()), &t)
            .await,
        Err(EngineError::UnsupportedScheme { .. })
    ));
}

#[tokio::test]
async fn error_details_do_not_contain_url_secrets() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let mut s = spec(
        HttpMethod::Get,
        format!("http://127.0.0.1:{port}/?api_key=dummy-secret-value"),
    );
    s.query = vec![KeyValue::new("token", "dummy-secret-two")];
    let err = engine()
        .send(&s, &CancellationToken::new())
        .await
        .unwrap_err();
    let json = serde_json::to_string(&err).unwrap();
    assert!(!json.contains("dummy-secret-value"), "{json}");
    assert!(!json.contains("dummy-secret-two"), "{json}");
}

#[tokio::test]
async fn untrusted_tls_certificate_is_rejected() {
    use std::sync::Arc;
    use tokio_rustls::TlsAcceptor;
    use tokio_rustls::rustls::ServerConfig;
    use tokio_rustls::rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};

    let cert = rcgen::generate_simple_self_signed(vec!["localhost".to_owned()]).unwrap();
    let cert_der: CertificateDer<'static> = cert.cert.der().clone();
    let key = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(cert.signing_key.serialize_der()));
    let config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(vec![cert_der], key)
        .unwrap();
    let acceptor = TlsAcceptor::from(Arc::new(config));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        if let Ok((stream, _)) = listener.accept().await {
            let _ = acceptor.accept(stream).await;
        }
    });

    let err = engine()
        .send(
            &spec(HttpMethod::Get, format!("https://localhost:{port}/")),
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
    assert!(matches!(err, EngineError::Tls { .. }), "{err:?}");
}

/// 受信したリクエストを確認するためのヘルパー（デバッグ時に使う）。
#[allow(dead_code)]
fn dump(r: &Request) -> String {
    format!("{} {}", r.method, r.url)
}
