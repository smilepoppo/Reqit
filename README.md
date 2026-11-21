<p align="center">
  <img src="public/reqit.svg" width="88" alt="Reqit">
</p>

<h1 align="center">Reqit（レキット）</h1>

<p align="center">
  <b>APIリクエストを、もっと手軽に。</b><br>
  Send. Inspect. Debug.
</p>

<p align="center">
  日本語 | <a href="README.en.md">English</a>
</p>

---

Reqit は、Postman を起動するほどではない API の動作確認を、すぐに実行できる軽量なデスクトップアプリです。名前の由来は「Request it!」です。

- **アカウント登録は不要です。** データはすべて手元の PC に保存し、クラウドには送りません。
- **1 画面で完結します。** 起動するとすぐ URL を入力でき、リクエストとレスポンスを同じ画面で確認できます。
- **日本語 UI が標準です。** エラーの原因も日本語で表示します。英語にも切り替えられます。
- **軽量です。** Tauri 2 と Microsoft Edge WebView2 で動作します。

> [!NOTE]
> 現在は v0.1（開発中）です。Windows 11 を最初の対応 OS としています。

## スクリーンショット

<!-- TODO: Windows 版のスクリーンショットに差し替える -->

（準備中）

## 主な機能（v0.1）

| 区分       | 内容                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| リクエスト | GET / POST / PUT / PATCH / DELETE、URL、クエリパラメーター（URL 欄と表が連動）、ヘッダー、ボディ（JSON / テキスト） |
| 認証       | Basic 認証、Bearer トークン                                                                                         |
| レスポンス | ステータス、ヘッダー、整形表示（JSON 構文ハイライト）、Raw 表示、応答時間、サイズ                                   |
| エラー     | DNS・接続・TLS・タイムアウトなどの通信エラーと、HTTP ステータスに応じたヒントを日本語で表示                         |
| 操作       | 送信中のキャンセル、タイムアウト設定、前回入力の自動復元、ダーク / ライトモード                                     |

### キーボードショートカット

| キー             | 動作                           |
| ---------------- | ------------------------------ |
| `Ctrl` + `Enter` | 送信（ボディ編集中でも有効）   |
| `Esc`            | 送信中のリクエストをキャンセル |
| `Ctrl` + `L`     | URL 欄へ移動                   |

## プライバシーとセキュリティ

- 通信は Reqit から API サーバーへ直接送信します。Reqit の開発者や第三者のサーバーは経由しません。
- パスワード、トークン、`Authorization`・`Cookie`・`X-API-Key` などの値は、Windows の資格情報マネージャーに保存します。設定ファイル（JSON）には書き込みません。
- TLS 証明書は常に検証します。
- 別のホストへリダイレクトされた場合、`Authorization` や `Cookie` ヘッダーは自動で取り除かれます。

詳しくは [SECURITY.md](SECURITY.md) を参照してください。

## インストール

1. [GitHub Releases](https://github.com/smilepoppo/Reqit/releases) を開き、最新版の `Reqit_<バージョン>_x64-setup.exe` をダウンロードします（MSI 形式の `.msi` もあります）。
2. ダウンロードしたファイルを実行し、画面の案内に従ってインストールします。`setup.exe` の場合、管理者権限は不要です。
3. アンインストールは、Windows の「設定」→「アプリ」→「インストールされているアプリ」から行えます。

> [!NOTE]
> v0.1.0 は公開の準備中です。公開までは、下の「ソースからのビルド」を使ってください。

### 「Windows によって PC が保護されました」と表示された場合

現在の Reqit には、コード署名がありません。そのため、初回の実行時に Microsoft Defender SmartScreen の警告が表示されることがあります。

1. ダウンロードしたファイルが本物か確認します（次の「ファイルの検証」を参照）。
2. 警告画面の「詳細情報」を押します。
3. 発行元が「不明な発行元」と表示されていることを確認し、「実行」を押します。

コード署名は、OSS 向けの無料の署名サービスへの申請を検討しています。

### ファイルの検証

各リリースには、ファイルが改ざんされていないか確認するための `SHA256SUMS.txt` が付いています。PowerShell で次を実行し、表示された値が `SHA256SUMS.txt` の値と一致することを確認してください。

```powershell
Get-FileHash .\Reqit_0.1.0_x64-setup.exe -Algorithm SHA256
```

各リリースには、使用しているライブラリの一覧（SBOM、SPDX 形式）も付いています。

## ソースからのビルド（Windows 11）

### 必要なもの

- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（「C++ によるデスクトップ開発」）
- Microsoft Edge WebView2 Runtime（Windows 11 には標準で入っています）
- [Rust](https://www.rust-lang.org/tools/install)（stable、1.90 以上）
- [Node.js](https://nodejs.org/) 22 以上と [pnpm](https://pnpm.io/) 10

### 手順

```powershell
git clone https://github.com/smilepoppo/Reqit.git
cd Reqit
pnpm install
pnpm tauri dev      # 開発モードで起動
pnpm tauri build    # インストーラー（NSIS / MSI）を作成
```

## 開発

```sh
pnpm check                                             # 型チェック・ESLint・Prettier・Vitest
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace                                 # ローカルのモックサーバーで通信を検証
```

設計は [docs/architecture.md](docs/architecture.md)、今後の計画は [docs/plan.md](docs/plan.md) にまとめています。コントリビュートの方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ロードマップ

- **v0.1** API テスター（現在）
- **v0.2** curl のインポート / エクスポート、リクエスト履歴、JSON の差分比較、デバッグ情報のエクスポート
- **v0.3** 内蔵ブラウザ：ブラウザで発生した通信を取り込み、編集・再送信・比較する
- **v0.4 以降** 通信タイムライン、JSONPath 検索、テンプレート、ローカルプロキシ など

## ライセンス

[MIT License](LICENSE)
