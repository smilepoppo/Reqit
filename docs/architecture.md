# Reqit アーキテクチャ

## 全体像

```
┌──────────────────────── Tauri アプリ（1ウィンドウ） ────────────────────────┐
│  WebView2 (React + TypeScript)                                              │
│   ├─ Request 編集（URL / Query / Headers / Body / Auth）                    │
│   ├─ Response 表示（Status / Headers / Pretty / Raw）                       │
│   └─ lib/ipc.ts ── invoke() ──┐   ※ UI から直接 HTTP 通信はしない          │
│                               │                                            │
│  Rust: src-tauri（薄いシェル）▼                                            │
│   ├─ commands.rs   : IPC コマンド（send / cancel / load / save）            │
│   ├─ secret.rs     : Secret Store（Windows Credential Manager）             │
│   └─ AppState      : 送信中リクエストのキャンセル用トークン                  │
│                               │                                            │
│  Rust: crates/reqit-core（UI 非依存・単体テスト可能）                        │
│   ├─ model.rs     : 通信データの共通モデル（RequestSpec / ResponseData）     │
│   ├─ engine.rs    : Request Engine（reqwest）                               │
│   ├─ error.rs     : エラー分類（UI で翻訳するためのコード）                 │
│   ├─ secrets.rs   : 秘密情報の分離・マスク                                  │
│   └─ draft.rs     : History Store（前回入力の保存・復元）                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 設計判断

### Rust を 2 クレートに分ける

- `crates/reqit-core`：通信・モデル・保存ロジック。Tauri や WebView に依存しない
- `src-tauri`：Tauri のコマンド定義と OS 連携だけを置く

GUI ライブラリがない環境（CI の Linux ジョブなど）でも、通信エンジンのテストを実行できます。将来 CLI 版を作る場合も、コアを再利用できます。

### 通信データの共通モデル

`RequestSpec` と `ResponseData` は、取得方法（Direct / Browser / Proxy）に関係なく同じ形で扱います。`HttpExchange` は、1回分のリクエストとレスポンスの組と、取得元（`CaptureSource`）を持ちます。v0.1 で使う取得元は `Direct`（Reqit 自身の通信）だけです。抽象化は、この共通モデルに留めます。Capture Adapter のトレイトは、v0.3 の技術検証で要件が固まってから定義します。

### エラーはコードで返し、文言は UI で決める

Rust 側は `EngineError`（`kind` と詳細）を返し、日本語・英語の文言は UI の辞書で決めます。翻訳を UI に集約し、Rust 側にはユーザー向け文言を持たせません。

### 秘密情報の扱い

- 認証情報（Basic のパスワード、Bearer トークン）と、秘密情報らしい名前のヘッダー値・クエリ値（`Authorization`、`Cookie`、`X-API-Key`、`token` など）は、保存時に `secrets.rs` で分離する
- 分離した値は Secret Store（Windows Credential Manager）に保存し、JSON ファイルには空文字を書く
- Secret Store が使えない、または容量上限（Windows は 1 件あたり 2,560 バイト）を超える場合は、秘密情報を保存しない（平文保存へのフォールバックはしない）
- ログに秘密情報を出力しない。エラー詳細にも URL のクエリやヘッダー値を含めない

### TLS とリダイレクト

- TLS 証明書は常に検証する。検証を無効にする設定は v0.1 では提供しない
- リダイレクトは最大 10 回まで追従する。reqwest は、別ホストへのリダイレクト時に `Authorization`・`Cookie` などを自動で除去する。この動作はテストで確認する
- Cookie は保持しない（リクエストごとに独立）

### 大きなレスポンス

本文は最大 20 MiB まで読み込み、超えた分は破棄して「切り詰め」フラグを立てます。UI は CodeMirror の仮想スクロールで表示し、大きな JSON は整形を省略します。

### Tauri IPC の権限

`build.rs` でアプリのコマンドを宣言し、`capabilities/default.json` で必要なコマンドだけを許可します。ファイルシステムやシェルのプラグインは使いません。CSP も設定します。

## ディレクトリ構成

```
Reqit/
├─ Cargo.toml              # Rust ワークスペース
├─ crates/reqit-core/      # 通信エンジンとモデル
├─ src-tauri/              # Tauri アプリ本体
├─ src/                    # React フロントエンド
│  ├─ components/
│  ├─ hooks/
│  ├─ i18n/
│  └─ lib/
├─ docs/                   # 設計資料・計画
├─ scripts/                # 開発補助スクリプト
└─ .github/                # CI・テンプレート
```
