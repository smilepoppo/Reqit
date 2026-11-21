# リリース手順

メンテナー向けの、Reqit を GitHub Releases で公開する手順です。

## 仕組み

- `v*.*.*` の形のタグを push すると、`.github/workflows/release.yml` が動く
- ワークフローは Environment `release` を使う。承認者（メンテナー）が GitHub 上で承認するまで、ビルドは始まらない
- ビルドが終わると、GitHub Releases に **下書き（Draft）** が作られる。自動では公開されない
- 下書きには、次のファイルが添付される

| ファイル                           | 内容                                                               |
| ---------------------------------- | ------------------------------------------------------------------ |
| `Reqit_<バージョン>_x64-setup.exe` | インストーラー（NSIS、推奨）                                       |
| `Reqit_<バージョン>_x64_en-US.msi` | インストーラー（MSI）                                              |
| `SHA256SUMS.txt`                   | 上記ファイルと SBOM のチェックサム                                 |
| `reqit-v<バージョン>.spdx.json`    | SBOM（GitHub の依存関係グラフから生成、SPDX 形式）                 |
| `THIRD_PARTY_LICENSES.html`        | 同梱しているサードパーティのライセンス文（アプリにも組み込まれる） |

## ライセンス文の同梱

MIT・Apache-2.0 などのライセンスは、配布物に著作権表示とライセンス文を含めることを求めています。そのため、リリース用ワークフローでは `pnpm licenses:generate` を実行し、次の 2 か所に同梱します。

- アプリ本体（画面右上の「ライセンス」から表示）
- GitHub Releases の `THIRD_PARTY_LICENSES.html`

生成には `cargo-about`（`cargo install cargo-about --locked --features cli`）を使います。対象とするライセンスは `about.toml` で、`deny.toml` と同じものだけを許可しています。新しい依存ライブラリを追加したときは、手元で `pnpm licenses:generate` を実行して、エラーにならないことを確認してください。

## 手順

### 1. バージョンを上げる PR を作る

次の 3 か所のバージョンを同じ値にします。ずれていると、リリース用ワークフローが失敗します。

- `package.json` の `version`
- `src-tauri/tauri.conf.json` の `version`
- `Cargo.toml`（ワークスペース）の `[workspace.package]` の `version`

あわせて `CHANGELOG.md` の `[Unreleased]` を `[0.1.0] - YYYY-MM-DD` のように書き換えます。PR の CI が通ったら、`main` にマージします。

### 2. タグを作って push する

`main` の最新コミットにタグを付けます。

```powershell
git switch main
git pull
git tag v0.1.0
git push origin v0.1.0
```

### 3. ワークフローを承認する

GitHub の「Actions」タブで、Release ワークフローが「Waiting」になっています。「Review deployments」から `release` を選んで承認します。

### 4. 下書きを確認して公開する

GitHub の「Releases」で下書きを開き、次を確認してから「Publish release」を押します。

- インストーラー 2 つ、`SHA256SUMS.txt`、SBOM が添付されている
- Windows 11 でインストールと起動ができる（可能であれば）
- リリースノートの内容

## コード署名について

現在のインストーラーには、コード署名がありません。OSS 向けの無料サービス SignPath Foundation（https://signpath.org/ ）への申請を検討しています。申請の主な条件は次のとおりです（2026-11-21 に公式ページで確認）。

- 署名したい形で、すでにリリースされていること（v0.1.0 の公開が先）
- 実行ファイルの場合、検証できる評判（利用実績）があること
- GitHub と SignPath の両方で 2 段階認証を使うこと
- 承認後、README とリリースページに「Code signing policy」を記載すること。記載内容は、決められた文言、チームの役割（Authors / Reviewers / Approvers）、プライバシーポリシー
- リリースのたびに、署名を手動で承認すること

v0.4 以降で検討している「HTTPS 通信解析」は、条件の「セキュリティ対策を回避する機能を含まない」に抵触するおそれがあります。実装前に確認が必要です。
