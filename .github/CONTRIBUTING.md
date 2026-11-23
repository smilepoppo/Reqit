# コントリビューションガイド / Contributing

Reqit に興味を持っていただき、ありがとうございます。Issue や Pull Request は日本語・英語のどちらでも歓迎します。

Thank you for your interest! Issues and pull requests are welcome in either Japanese or English.

## はじめる前に

- 参加するすべての方に、[行動規範](CODE_OF_CONDUCT.md) を守っていただくようお願いします。
- 大きな変更（新機能、設計の変更、依存ライブラリの追加）は、先に Issue で相談してください。
- 設計方針は [docs/architecture.md](../docs/architecture.md)、開発ルールは [CLAUDE.md](../CLAUDE.md) にまとめています。AI エージェントだけでなく、人間のコントリビューターにも同じルールを適用します。

## 開発環境

[README.md](../README.md#ソースからのビルドwindows-11) の「ソースからのビルド」を参照してください。Linux でも開発やテストはできます（WebKitGTK が必要です）。

## Pull Request の前に

```sh
pnpm check
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm secrets:scan   # gitleaks が必要
```

## ルール

- 1 つの PR では、1 つの目的に絞ってください。
- 振る舞いを変えたら、テストを追加・更新してください。
- UI の文言を変えたら、`src/i18n/ja.ts` と `src/i18n/en.ts` の両方を更新してください。
- 本物の API キー、トークン、社内 URL、個人情報を、コード、テスト、スクリーンショットに含めないでください。サンプルには `example.com` を使ってください。
- 新しい依存ライブラリを追加する場合は、必要な理由とライセンスを PR に書いてください。MIT と両立しないライセンスは使えません。

## ライセンス

コントリビュートしたコードは、[MIT License](../LICENSE) で公開されることに同意したものとみなします。
