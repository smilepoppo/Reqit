# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、バージョン番号は [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

## [0.1.0] - 2026-11-23

最初の公開版です。Windows 11 向けのインストーラー（署名なし）を配布します。

### 追加

- v0.1 API テスター
  - GET / POST / PUT / PATCH / DELETE の送信
  - クエリパラメーター（URL 欄と表が連動）、ヘッダー、ボディ（JSON / テキスト）の編集
  - Basic 認証、Bearer トークン
  - ステータス、ヘッダー、整形表示（JSON 構文ハイライト）、Raw 表示、応答時間、サイズの表示
  - 通信エラーと HTTP ステータスに応じたヒントの日本語表示
  - 送信中のキャンセル、タイムアウト設定
  - 前回入力の自動復元（秘密情報は Windows 資格情報マネージャーに保存）
  - ダーク / ライトモード、日本語 / 英語 UI、キーボードショートカット
- リリース用ワークフロー：タグとアプリのバージョンの一致確認、SBOM（SPDX 形式）と SHA256 チェックサムの添付
- README：インストール方法、SmartScreen の警告への対処、ダウンロードしたファイルの検証方法
- サードパーティのライセンス一覧（アプリの「ライセンス」から表示。リリースにも THIRD_PARTY_LICENSES.html として添付）
- 行動規範（Contributor Covenant 2.1 を採用。報告は GitHub の非公開フォームで受け付け）
- CI（型チェック、ESLint、Prettier、Vitest、cargo fmt / clippy / test、シークレットスキャン、依存ライブラリの検査、Windows ビルド、E2E スモークテスト）

[Unreleased]: https://github.com/smilepoppo/Reqit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/smilepoppo/Reqit/releases/tag/v0.1.0
