# セキュリティポリシー / Security Policy

## 脆弱性の報告 / Reporting a vulnerability

脆弱性を見つけた場合は、公開 Issue には書かず、GitHub の [Private vulnerability reporting](https://github.com/smilepoppo/Reqit/security/advisories/new) から非公開で報告してください。

Please do **not** open a public issue. Report privately via [GitHub Security Advisories](https://github.com/smilepoppo/Reqit/security/advisories/new).

報告には、再現手順、影響範囲、Reqit のバージョンと OS を含めてください。報告に実際のトークンや個人情報を含めないでください。個人開発のため返信まで時間がかかる場合がありますが、確認後に対応方針をお知らせします。

## 対応バージョン / Supported versions

| バージョン     | 対応 |
| -------------- | ---- |
| 最新のリリース | ✅   |
| それ以前       | ❌   |

## Reqit のセキュリティ設計 / Security design

| 項目                 | 方針                                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 通信                 | HTTP 通信はすべて Rust（reqwest）で実行する。UI（WebView）から外部へ直接通信しない                                                                                                             |
| TLS                  | 証明書は常に検証する（OS の証明書ストアを利用）。検証を無効にする設定はない                                                                                                                    |
| リダイレクト         | 最大 10 回。別のホスト・ポートへ移るときは `Authorization`・`Cookie` などを除去する                                                                                                            |
| Cookie               | 保持しない。リクエストごとに独立して送信する                                                                                                                                                   |
| 秘密情報の保存       | パスワード、トークン、秘密情報らしい名前のヘッダー・クエリの値は、Windows 資格情報マネージャーに保存する。設定ファイルには書かない。保存できない場合は破棄し、平文保存にはフォールバックしない |
| ログ                 | 認証情報、ヘッダー値、URL のクエリをログやエラー詳細に出力しない                                                                                                                               |
| 巨大なレスポンス     | 本文は 20 MiB まで読み込み、超えた分は破棄する                                                                                                                                                 |
| IPC                  | アプリのコマンドは 4 つだけを許可し、ファイルシステムやシェルのプラグインは使わない                                                                                                            |
| CSP                  | `default-src 'self'` を基本とする Content Security Policy を設定している                                                                                                                       |
| 依存ライブラリ       | CI で `cargo audit`、`cargo deny`、`pnpm audit` を実行する                                                                                                                                     |
| シークレットスキャン | CI で gitleaks により Git 履歴全体を検査する                                                                                                                                                   |

秘密情報の判定は名前に基づくため、完全ではありません。独自の名前で秘密情報を送る場合は、その値が設定ファイルに保存される可能性があることに注意してください。
