## 概要 / Summary

<!-- 何を、なぜ変更したかを書いてください。 / What changed and why. -->

## 関連 Issue / Related issues

<!-- 例: Closes #123 -->

## 確認したこと / Checklist

- [ ] `pnpm check`（型チェック・ESLint・Prettier・Vitest）が通る
- [ ] `cargo fmt --all -- --check` と `cargo clippy --workspace --all-targets -- -D warnings` が通る
- [ ] `cargo test --workspace` が通る
- [ ] UI の文言を変更した場合、`src/i18n/ja.ts` と `src/i18n/en.ts` の両方を更新した
- [ ] 秘密情報（API キー、トークン、社内 URL、個人情報）を含めていない
- [ ] 新しい依存ライブラリを追加した場合、その理由とライセンスを説明した

## スクリーンショット / Screenshots

<!-- UI を変更した場合は添付してください。個人情報やトークンが写らないよう注意してください。 -->
