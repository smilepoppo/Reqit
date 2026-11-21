// 日本語の UI 文言（標準言語）。キーを追加したら en.ts にも追加すること（型で検出される）。
// {name} 形式のプレースホルダーは t() の第 2 引数で置き換える。

export const ja = {
  "app.tagline": "APIリクエストを、もっと手軽に。",
  "app.notTauri":
    "ブラウザ上で実行しています。通信機能を使うには、デスクトップアプリ（pnpm tauri dev）で起動してください。",

  "about.licenses": "ライセンス",
  "about.licensesTitle": "サードパーティのライセンス",
  "about.close": "閉じる",
  "about.licensesDev":
    "開発モードでは表示できません。pnpm licenses:generate で生成したあと、pnpm tauri build でビルドしたアプリで確認してください。",

  "theme.label": "テーマ",
  "theme.system": "OSに合わせる",
  "theme.light": "ライト",
  "theme.dark": "ダーク",
  "lang.label": "言語",

  "request.method": "HTTPメソッド",
  "request.url": "URL",
  "request.urlPlaceholder": "https://api.example.com/users を入力（Ctrl+L）",
  "request.send": "送信",
  "request.cancel": "キャンセル",
  "request.sendHint": "Ctrl+Enter で送信",
  "request.cancelHint": "Esc でキャンセル",

  "tab.params": "パラメーター",
  "tab.headers": "ヘッダー",
  "tab.body": "ボディ",
  "tab.auth": "認証",
  "tab.settings": "設定",

  "kv.key": "キー",
  "kv.value": "値",
  "kv.enabled": "有効",
  "kv.remove": "削除",
  "kv.addKey": "キーを追加",
  "kv.addValue": "値",

  "body.none": "なし",
  "body.json": "JSON",
  "body.text": "テキスト",
  "body.noneHint": "このリクエストはボディを送信しません。",
  "body.format": "整形",
  "body.invalidJson": "JSONとして正しくありません: {message}",
  "body.contentTypeHint": "Content-Type を指定しない場合は「{value}」を自動で付けます。",

  "auth.none": "なし",
  "auth.basic": "Basic認証",
  "auth.bearer": "Bearerトークン",
  "auth.username": "ユーザー名",
  "auth.password": "パスワード",
  "auth.token": "トークン",
  "auth.show": "表示",
  "auth.hide": "隠す",
  "auth.noneHint": "認証ヘッダーを付けません。",
  "auth.overrideHint":
    "ここで設定した認証は、ヘッダーに手入力した Authorization より優先されます。",
  "auth.storageHint":
    "パスワードとトークンは、Windows の資格情報マネージャーに保存します。設定ファイルには書き込みません。",

  "settings.timeout": "タイムアウト（秒）",
  "settings.timeoutHint": "0 にすると無制限です。最大 {max} 秒まで指定できます。",

  "response.title": "レスポンス",
  "response.empty": "URLを入力して送信すると、ここにレスポンスを表示します。",
  "response.sending": "送信中… {elapsed}",
  "response.time": "応答時間",
  "response.ttfb": "最初のバイトまで {value}",
  "response.size": "サイズ",
  "response.pretty": "整形",
  "response.raw": "Raw",
  "response.headers": "ヘッダー",
  "response.copy": "コピー",
  "response.copied": "コピーしました",
  "response.truncated": "レスポンスが大きいため、先頭 {size} だけを表示しています。",
  "response.binary":
    "本文に UTF-8 として読めないデータが含まれています。バイナリの可能性があります。",
  "response.invalidJson":
    "Content-Type は JSON ですが、本文を JSON として解析できませんでした: {message}",
  "response.prettySkipped": "本文が大きいため、整形せずに表示しています。",
  "response.noBody": "本文はありません。",

  "status.4xx": "クライアント側のエラーです。リクエストの内容を確認してください。",
  "status.5xx":
    "サーバー側のエラーです。時間をおいて再試行するか、サーバーのログを確認してください。",
  "status.400":
    "リクエストの形式が正しくありません。ボディ、パラメーター、Content-Type を確認してください。",
  "status.401":
    "認証が必要です。認証タブのトークンやパスワードが正しいか、期限切れでないか確認してください。",
  "status.403": "アクセスが拒否されました。認証は通っていても、権限が足りない可能性があります。",
  "status.404": "リソースが見つかりません。URL のパスと HTTP メソッドを確認してください。",
  "status.405": "この URL では、指定した HTTP メソッドを使えません。",
  "status.408": "サーバー側でリクエストがタイムアウトしました。",
  "status.409": "リソースの状態と競合しています。重複登録や更新の競合がないか確認してください。",
  "status.413": "リクエストのボディが大きすぎます。",
  "status.415": "サーバーが対応していない Content-Type です。ヘッダーを確認してください。",
  "status.422":
    "形式は正しいものの、内容に問題があります。レスポンス本文のエラー詳細を確認してください。",
  "status.429":
    "リクエストが多すぎます。Retry-After ヘッダーがあれば、その時間だけ待ってから再試行してください。",
  "status.500": "サーバー内部でエラーが発生しました。サーバーのログを確認してください。",
  "status.502": "ゲートウェイやプロキシが、上流のサーバーから正しい応答を受け取れませんでした。",
  "status.503": "サーバーが一時的に利用できません。メンテナンス中か、過負荷の可能性があります。",
  "status.504": "ゲートウェイやプロキシで、上流のサーバーの応答がタイムアウトしました。",

  "error.title": "リクエストを完了できませんでした",
  "error.emptyUrl": "URLを入力してください。",
  "error.invalidUrl": "URLの形式が正しくありません。",
  "error.unsupportedScheme":
    "「{scheme}:」には対応していません。http:// または https:// で始まるURLを入力してください。",
  "error.invalidHeaderName": "ヘッダー名「{name}」に使えない文字が含まれています。",
  "error.invalidHeaderValue":
    "ヘッダー「{name}」の値に使えない文字（改行や全角文字など）が含まれています。",
  "error.timeout": "{seconds} 秒以内に応答がなかったため、タイムアウトしました。",
  "error.cancelled": "リクエストをキャンセルしました。",
  "error.dns":
    "ホスト名を解決できませんでした。URL のつづりと、ネットワーク接続を確認してください。",
  "error.connect":
    "サーバーに接続できませんでした。サーバーが起動しているか、ポート番号が正しいか確認してください。",
  "error.tls":
    "安全な接続（TLS）を確立できませんでした。証明書が無効、期限切れ、または自己署名の可能性があります。",
  "error.tooManyRedirects":
    "リダイレクトが多すぎます。リダイレクトがループしている可能性があります。",
  "error.body": "レスポンス本文の受信中に通信が途切れました。",
  "error.other": "通信中に予期しないエラーが発生しました。",
  "error.details": "詳細",

  "persist.tooLarge":
    "認証情報が大きすぎるため、資格情報マネージャーに保存できませんでした。次回起動時は再入力が必要です。",
  "persist.unavailable":
    "資格情報マネージャーを利用できないため、認証情報を保存していません。次回起動時は再入力が必要です。",
} as const;
