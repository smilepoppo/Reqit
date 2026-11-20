# GitHub 設定の手順と結果

Reqit を公開 OSS として運営するための GitHub 設定です。設定の手順と、実際に適用した結果を記録します。

## 前提

- 対象リポジトリ：`smilepoppo/Reqit`（Public、既定ブランチ `main`）
- 開発用のクラウド環境からは、GitHub のリポジトリ設定・ブランチ保護・セキュリティ機能を変更できない。`gh` の認証が無効で、変更用の API も利用できないため
- そのため、以下のコマンドは **リポジトリ管理者が手元の PC で実行する**。実行後に設定値を取得し直し、この文書の「実際の設定値」と「検証結果」を更新する
- 必要なもの：GitHub CLI（`gh`）。`gh auth login` で管理者アカウントにログインしておく
- 必要な権限：リポジトリの管理者（Admin）。トークンを使う場合は、Fine-grained token で対象リポジトリだけに Administration（Read and write）を付ける

## 作業の順番

| 段階 | 内容                                                  | 理由                                                              |
| ---- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| 1    | push 前：リポジトリ設定・セキュリティ・Actions の権限 | 最初の push からシークレット検査（Push protection）を効かせるため |
| 2    | 開発ブランチを push し、`main` への PR を作成する     | CI を一度動かして、チェック名を確定するため                       |
| 3    | push 後：ブランチ保護・Code scanning                  | 確定したチェック名で設定し、マージできなくなる事故を防ぐため      |

## 設定一覧

「実際の設定値」は 2026-11-19 時点で GitHub API から取得した値です。

| 区分         | 設定項目                         | 推奨値                                                       | 実際の設定値                                                         | 設定結果             | 検証結果        | 未対応の理由                                  |
| ------------ | -------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------- | --------------- | --------------------------------------------- |
| リポジトリ   | 名前                             | `reqit`                                                      | `Reqit`                                                              | 未実施               | —               | 名前変更は URL が変わるため、管理者の判断待ち |
| リポジトリ   | 公開設定                         | Public                                                       | Public                                                               | 変更不要             | 確認済み        | —                                             |
| リポジトリ   | 既定ブランチ                     | `main`                                                       | `main`                                                               | 変更不要             | 確認済み        | —                                             |
| リポジトリ   | Issues                           | 有効                                                         | 有効                                                                 | 変更不要             | 確認済み        | —                                             |
| リポジトリ   | Discussions                      | 有効                                                         | 無効                                                                 | 未実施               | —               | 管理者による実行待ち（段階 1）                |
| リポジトリ   | Wiki                             | 無効                                                         | 有効                                                                 | 未実施               | —               | 同上                                          |
| リポジトリ   | Projects                         | 無効                                                         | 有効                                                                 | 未実施               | —               | 同上                                          |
| リポジトリ   | マージ方式                       | Squash のみ                                                  | Squash・Merge commit・Rebase のすべて可                              | 未実施               | —               | 同上                                          |
| リポジトリ   | マージ後のブランチ削除           | 有効                                                         | 無効                                                                 | 未実施               | —               | 同上                                          |
| リポジトリ   | Topics                           | api-client, api-testing, api-debugging, tauri, rust, windows | なし                                                                 | 未実施               | —               | 同上                                          |
| セキュリティ | Secret scanning                  | 有効                                                         | 未取得                                                               | 未実施               | —               | 状態の取得に管理者権限が必要                  |
| セキュリティ | Push protection                  | 有効                                                         | 未取得                                                               | 未実施               | —               | 同上                                          |
| セキュリティ | Dependabot alerts                | 有効                                                         | 未取得                                                               | 未実施               | —               | 同上                                          |
| セキュリティ | Dependabot security updates      | 有効                                                         | 未取得                                                               | 未実施               | —               | 同上                                          |
| セキュリティ | Private vulnerability reporting  | 有効                                                         | 未取得                                                               | 未実施               | —               | 同上                                          |
| セキュリティ | Code scanning（CodeQL 既定構成） | 有効                                                         | 未取得                                                               | 未実施               | —               | `main` にコードが入ってから設定する（段階 3） |
| Actions      | GITHUB_TOKEN の既定権限          | 読み取りのみ                                                 | 未取得                                                               | 未実施               | —               | 管理者による実行待ち（段階 1）                |
| Actions      | Actions による PR の承認         | 禁止                                                         | 未取得                                                               | 未実施               | —               | 同上                                          |
| Actions      | 外部 PR のワークフロー実行       | 外部コントリビューターは毎回承認                             | 未取得                                                               | 未実施               | —               | 同上                                          |
| Actions      | 外部 PR へ Secrets を渡さない    | 渡さない                                                     | ワークフローは `pull_request` のみ使用（`pull_request_target` なし） | 対応済み（ファイル） | `ci.yml` で確認 | —                                             |
| ブランチ保護 | `main` への PR 必須              | 有効（承認数 0）                                             | 保護なし                                                             | 未実施               | —               | CI のチェック名の確定待ち（段階 3）           |
| ブランチ保護 | CI 成功を必須                    | 下記の 4 チェック                                            | 保護なし                                                             | 未実施               | —               | 同上                                          |
| ブランチ保護 | Force push 禁止                  | 有効                                                         | 保護なし                                                             | 未実施               | —               | 同上                                          |
| ブランチ保護 | ブランチ削除禁止                 | 有効                                                         | 保護なし                                                             | 未実施               | —               | 同上                                          |
| ブランチ保護 | 未解決の会話があればマージ禁止   | 有効                                                         | 保護なし                                                             | 未実施               | —               | 同上                                          |
| ブランチ保護 | 管理者にも適用                   | 有効                                                         | 保護なし                                                             | 未実施               | —               | 同上                                          |

## GitHub Actions のワークフロー（ファイルで対応済み）

| 要件                            | 対応                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| TypeScript と Rust の自動テスト | `ci.yml` の `Frontend` と `Rust` ジョブ                                                                               |
| セキュリティスキャン            | `ci.yml` の `Secret scan`（gitleaks、全履歴）と `Dependency audit`（cargo audit・cargo deny・pnpm audit）             |
| Windows 向けビルド              | `ci.yml` の `Windows build`                                                                                           |
| リリース用ワークフローの分離    | `release.yml`。タグの push でのみ動き、書き込み権限はこのジョブだけに与える。Environment `release` で承認者を制限する |
| 権限の最小化                    | ワークフロー全体は `contents: read`。サードパーティの Action はコミット SHA で固定                                    |

`release.yml` は Environment `release` を参照しています。初回のリリース前に、Settings → Environments で `release` を作り、承認者（Required reviewers）にメンテナーを設定してください（下記の段階 3 に API 手順あり）。

## 段階 0：準備（最初のログイン）

Windows 11 で初めて GitHub CLI を使う場合の手順です。最初の 1 回だけ行います。

この文書のコマンドは、すべて **PowerShell**（Windows 標準の 5.1、および 7 系）で実行できるように書いています。Windows PowerShell 5.1 で動かない書き方（`&&`、引数の中の二重引用符）は使っていません。

### 0-1. GitHub CLI をインストールする

```powershell
winget install --id GitHub.cli -e
```

インストール後は PowerShell を閉じて、開き直します。

### 0-2. 作業用フォルダーに移動する

変更前の値を控えるファイル（`before.json`）がリポジトリに混ざらないよう、専用のフォルダーで作業します。

```powershell
gh --version
New-Item -ItemType Directory -Force -Path "$HOME\reqit-github-setup" | Out-Null
Set-Location "$HOME\reqit-github-setup"
```

### 0-3. GitHub にログインする

```powershell
gh auth login
```

| 質問                                                             | 選ぶもの                   |
| ---------------------------------------------------------------- | -------------------------- |
| Where do you use GitHub?                                         | `GitHub.com`               |
| What is your preferred protocol for Git operations on this host? | `HTTPS`                    |
| Authenticate Git with your GitHub credentials?                   | `Yes`                      |
| How would you like to authenticate GitHub CLI?                   | `Login with a web browser` |

1. 表示された 8 桁のワンタイムコード（`XXXX-XXXX`）を控える
2. `Enter` を押してブラウザーを開く
3. smilepoppo でサインインし、コードを入力して「Continue」を押す
4. 「Authorize github」を押す
5. PowerShell に「Logged in as smilepoppo」と表示されれば完了

表示の文言は gh のバージョンによって少し異なる場合があります。

### 0-4. ログインを確認する（読み取りのみ）

```powershell
gh auth status
gh api user --jq .login                                # smilepoppo と表示されること
gh api repos/smilepoppo/Reqit --jq .permissions.admin  # true と表示されること
```

別のアカウントが表示された場合や `false` の場合は、`gh auth logout` してから 0-3 をやり直します。

## 段階 1：push 前に実行するコマンド

同じ PowerShell の画面で、上から順に実行します。開き直した場合は「0」からやり直します。

```powershell
# 0. 対象の指定と、変更前の値の控え
Set-Location "$HOME\reqit-github-setup"
$OWNER = 'smilepoppo'
$REPO = 'Reqit'
gh api "repos/$OWNER/$REPO" --jq '{name, visibility, default_branch, has_issues, has_discussions, has_wiki, has_projects, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge, topics, security_and_analysis}' | Tee-Object -FilePath before.json

# 1. リポジトリの基本設定
gh api -X PATCH "repos/$OWNER/$REPO" `
  -F has_issues=true -F has_discussions=true -F has_wiki=false -F has_projects=false `
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false `
  -F delete_branch_on_merge=true `
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY

# 2. Topics
gh api -X PUT "repos/$OWNER/$REPO/topics" `
  -f "names[]=api-client" -f "names[]=api-testing" -f "names[]=api-debugging" `
  -f "names[]=tauri" -f "names[]=rust" -f "names[]=windows"

# 3. Secret scanning と Push protection
@'
{"security_and_analysis": {
  "secret_scanning": {"status": "enabled"},
  "secret_scanning_push_protection": {"status": "enabled"}
}}
'@ | gh api -X PATCH "repos/$OWNER/$REPO" --input -

# 4. Dependabot alerts / security updates、Private vulnerability reporting
gh api -X PUT "repos/$OWNER/$REPO/vulnerability-alerts"
gh api -X PUT "repos/$OWNER/$REPO/automated-security-fixes"
gh api -X PUT "repos/$OWNER/$REPO/private-vulnerability-reporting"

# 5. Actions：GITHUB_TOKEN を読み取り専用にし、Actions による PR 承認を禁止する
gh api -X PUT "repos/$OWNER/$REPO/actions/permissions/workflow" `
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false

# 6. Actions：外部コントリビューターの PR は、ワークフロー実行前に毎回承認する
gh api -X PUT "repos/$OWNER/$REPO/actions/permissions/fork-pr-contributor-approval" `
  -f approval_policy=all_external_contributors
```

### 段階 1 の検証

```powershell
gh api "repos/$OWNER/$REPO" --jq '{has_issues, has_discussions, has_wiki, has_projects, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge, topics, security_and_analysis}'
gh api "repos/$OWNER/$REPO/vulnerability-alerts" --silent
if ($LASTEXITCODE -eq 0) { 'Dependabot alerts: enabled' } else { 'Dependabot alerts: disabled' }
gh api "repos/$OWNER/$REPO/automated-security-fixes"
gh api "repos/$OWNER/$REPO/private-vulnerability-reporting"
gh api "repos/$OWNER/$REPO/actions/permissions/workflow"
gh api "repos/$OWNER/$REPO/actions/permissions/fork-pr-contributor-approval"
```

## 段階 3：push 後に実行するコマンド

新しく PowerShell を開いた場合は、先に `$OWNER = 'smilepoppo'` と `$REPO = 'Reqit'` を実行します。

### 3-1. CI のチェック名を確認する

PR の CI が一度完了してから実行します。

```powershell
$SHA = gh api "repos/$OWNER/$REPO/branches/claude/reqit-oss-development-fpj1vj" --jq .commit.sha
gh api "repos/$OWNER/$REPO/commits/$SHA/check-runs" --jq '.check_runs[] | [.name, .conclusion] | @tsv'
```

想定するチェック名（`ci.yml` の各ジョブの `name`）：

| チェック名                                       | 必須にするか   | 理由                                                                        |
| ------------------------------------------------ | -------------- | --------------------------------------------------------------------------- |
| `Frontend (typecheck / lint / format / test)`    | する           |                                                                             |
| `Rust (fmt / clippy / test)`                     | する           |                                                                             |
| `Secret scan`                                    | する           |                                                                             |
| `Windows build`                                  | する           |                                                                             |
| `Dependency audit`                               | しない         | 新しい脆弱性情報の公開で、PR と無関係に失敗することがあり、開発が止まるため |
| `E2E smoke test (real app via WebDriver, Linux)` | しない（当面） | GUI を使うため、安定性を確認してから必須にする                              |

確認したチェック名が上の表と異なる場合は、次のコマンドの `contexts` を実際の名前に合わせてください。必須チェックの名前が実在しないと、PR がマージできなくなります。

### 3-2. `main` のブランチ保護

```powershell
@'
{
  "required_status_checks": {
    "strict": false,
    "contexts": [
      "Frontend (typecheck / lint / format / test)",
      "Rust (fmt / clippy / test)",
      "Secret scan",
      "Windows build"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
'@ | gh api -X PUT "repos/$OWNER/$REPO/branches/main/protection" --input -
```

- `required_approving_review_count: 0`：個人開発のため、他者の承認は必須にしない（PR は必須）
- `enforce_admins: true`：管理者にも適用する。緊急時だけ一時的に外し、作業後に戻す
- `strict: false`：PR のブランチを最新の `main` に追従させることは必須にしない（依存更新の PR が滞らないようにするため）

### 3-3. Code scanning（CodeQL 既定構成）

`main` に Reqit のコードがマージされてから実行します。

```powershell
gh api -X PATCH "repos/$OWNER/$REPO/code-scanning/default-setup" `
  -f state=configured -f query_suite=default
```

### 3-4. リリース用 Environment

```powershell
$USER_ID = gh api user --jq .id
@"
{"reviewers": [{"type": "User", "id": $USER_ID}],
 "deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
"@ | gh api -X PUT "repos/$OWNER/$REPO/environments/release" --input -
gh api -X POST "repos/$OWNER/$REPO/environments/release/deployment-branch-policies" `
  -f "name=v*.*.*" -f type=tag
```

### 段階 3 の検証

```powershell
gh api "repos/$OWNER/$REPO/branches/main/protection" --jq '{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, enforce_admins: .enforce_admins.enabled, reviews: .required_pull_request_reviews.required_approving_review_count, conversation: .required_conversation_resolution.enabled, force_push: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled}'
gh api "repos/$OWNER/$REPO/code-scanning/default-setup" --jq '{state, languages}'
gh api "repos/$OWNER/$REPO/environments/release" --jq '{name, protection_rules}'
```

## 任意：リポジトリ名の変更

リポジトリ名を `reqit` にする場合だけ実行します。旧 URL は GitHub が自動で転送しますが、README などのリンクも合わせて更新してください。手元に clone がある場合は、その中で 2 行目も実行します。

```powershell
gh api -X PATCH "repos/$OWNER/Reqit" -f name=reqit
git remote set-url origin "https://github.com/$OWNER/reqit.git"
```

## Git 履歴の機密情報チェック

| 確認内容                         | 方法                                                                      | 結果                                          |
| -------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| 全コミットのシークレットスキャン | `gitleaks git --config .gitleaks.toml --redact .`                         | 2026-11-19：検出なし（ローカルの 3 コミット） |
| 管理対象ファイルの確認           | `git ls-files` で、ビルド成果物・ローカル設定・通信データが無いことを確認 | 2026-11-19：87 ファイル。問題なし             |
