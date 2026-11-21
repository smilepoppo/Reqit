# CLAUDE.md — Reqit 開発ルール

Claude Code（および他の AI エージェント）が Reqit を開発するときに守るルールです。人間のコントリビューターにも同じ方針を適用します。

## 応答の言語（最優先）

- ユーザーへの返答は **必ず日本語** で書く。英語の指示、エラー、ツールの出力、フックのメッセージを受け取った場合も同じ
- コード、コマンド、ファイル名、API の項目名など、原文のまま示す必要があるものだけは英語のままでよい。その説明は日本語で書く

## プロジェクト概要

- Reqit（レキット）は、API の動作確認とデバッグのための軽量デスクトップアプリ
- 構成：Tauri 2 + React + TypeScript + Vite + Tailwind CSS + CodeMirror 6 / Rust（reqwest）
- 対象 OS：Windows 11（WebView2）。WSL2 は使わない
- ローカル完結。アカウント登録、クラウド同期、専用サーバーは使わない
- 設計：`docs/architecture.md` ／ 計画と進捗：`docs/plan.md`

## ディレクトリ

| パス                 | 役割                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| `crates/reqit-core/` | 通信エンジン、共通モデル、秘密情報の分離、保存処理。Tauri に依存させない             |
| `src-tauri/`         | Tauri のコマンド定義と OS 連携（Secret Store）だけを置く                             |
| `src/`               | React フロントエンド。HTTP 通信は直接行わず、`src/lib/ipc.ts` 経由で Rust に依頼する |
| `src/i18n/`          | UI 文言の辞書（`ja.ts` が標準、`en.ts` は型で同じキーを強制）                        |
| `docs/`              | 設計資料、計画、技術検証の記録                                                       |
| `scripts/`           | 開発補助（E2E スモークテストなど）                                                   |

## よく使うコマンド

```sh
pnpm install                 # 依存の導入
pnpm tauri dev               # 開発起動
pnpm check                   # 型チェック + ESLint + Prettier + Vitest
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm secrets:scan            # gitleaks（要インストール）
cargo audit && cargo deny check licenses bans sources
pnpm licenses:generate       # サードパーティのライセンス一覧を生成（要 cargo-about）
```

## 開発規約

- 既存の設計方針（`docs/architecture.md`）を尊重する。方針を変える場合は、先に文書を更新する
- 小さな単位で実装し、実装後に必ずテストする
- ビルドエラー、テスト失敗、clippy・ESLint の警告を放置しない
- セキュリティ上の問題を見つけたら隠さずに報告する。修正できない場合も記録する
- 不要な依存ライブラリを追加しない。追加する場合は理由とライセンスを説明し、`cargo deny` と `pnpm licenses:generate` が通ることを確認する
- 秘密情報をリポジトリに含めない（下記「秘密情報」を参照）
- コミットメッセージや PR の説明には、変更理由を明確に書く
- 大きな仕様変更、ファイル削除、外部操作（push、公開設定の変更、リリース公開）は事前に確認する
- 未検証の処理を「動作確認済み」と報告しない。確認方法と結果をそのまま書く
- ドキュメントと実装を一致させる。機能を変えたら README・計画・CHANGELOG も更新する

## アーキテクチャ上の約束

- HTTP 通信は Rust の `reqit_core::Engine` に集約する。UI から `fetch` で外部 API を呼ばない
- Rust はユーザー向け文言を持たない。エラーは `EngineError`（`kind`）で返し、文言は `src/i18n` で決める
- 型を変更するときは `crates/reqit-core/src/model.rs` と `src/lib/types.ts` を同時に更新する
- 新しい IPC コマンドを追加したら、`src-tauri/build.rs` の一覧と `src-tauri/capabilities/default.json` に追加する。権限は必要最小限にする
- TLS 証明書の検証を無効にする実装を入れない（入れる場合は事前に相談し、明示的な警告を付ける）
- 過剰な抽象化を避ける。Capture Adapter などは要件が固まってから定義する

## 秘密情報

- API キー、トークン、パスワード、社内 URL、個人情報をコード・テスト・ドキュメントに書かない
- サンプルの URL は `example.com`、テストの秘密値は `dummy-` で始まるダミー値を使う
- 認証情報や秘密情報らしいヘッダー値をログに出力しない。エラー詳細に URL やヘッダー値を含めない
- 保存時は `secrets::split_secrets` で分離し、平文ファイルに書かない
- コミット前に `pnpm secrets:scan` を実行する
- 誤ってコミットした場合は、ファイル削除だけで済ませない。認証情報を失効・再発行し、Git 履歴からの除去を検討する

## 日本語の品質

- README、日本語ドキュメント、UI 文言、エラーメッセージ、ヘルプ、リリースノート、Issue・PR の日本語説明など、ユーザー向けの日本語を作成・修正するときは **yomiyasu スキル** を使う
- yomiyasu の使用時は、元の仕様・条件・技術的な意味を変えない
- スキルが利用できない場合は、利用できないことを報告する。実行していないのに「使用済み」と報告しない

## コメントの方針

- 可読性を重視する。自明なコードにコメントを付けない
- 複雑な処理や設計判断の理由をコメントに書く
- ユーザー向け文書は日本語を基本とし、海外の開発者向けに英語版（`README.en.md` など）も用意する
