import type { ja } from "./ja";

export const en: Record<keyof typeof ja, string> = {
  "app.tagline": "Send. Inspect. Debug.",
  "app.notTauri": "Running in a browser. Start the desktop app (pnpm tauri dev) to send requests.",

  "about.licenses": "Licenses",
  "about.licensesTitle": "Third-party licenses",
  "about.close": "Close",
  "about.licensesDev":
    "Not available in development mode. Run pnpm licenses:generate and check it in an app built with pnpm tauri build.",

  "curl.imported": "Imported the curl command.",
  "curl.importFailed": "Could not import the curl command. {reason}",
  "curl.warn.unknownOption": 'Ignored unsupported option "{option}".',
  "curl.warn.insecureIgnored":
    "Ignored -k (--insecure). Reqit never disables TLS certificate verification.",
  "curl.warn.fileReferenceIgnored": 'Ignored the file reference (@file) in "{option}".',
  "curl.warn.multipartIgnored": "Ignored form uploads (-F), which are not supported yet.",
  "curl.err.notCurl": "Paste a command that starts with curl.",
  "curl.err.unterminatedQuote": "A quote is not closed. Make sure you copied the whole command.",
  "curl.err.missingValue": 'Option "{option}" has no value.',
  "curl.err.missingUrl": "No URL was found.",
  "curl.err.invalidUrl": "The URL is not valid.",
  "curl.err.unsupportedMethod": 'HTTP method "{method}" is not supported.',
  "curl.copy": "Copy as curl",
  "curl.copyBash": "Copy as bash",
  "curl.copyCmd": "Copy as cmd (Windows)",
  "curl.copied":
    "Copied the curl command. It may contain credentials, so be careful when sharing it.",
  "notice.close": "Close",

  "theme.label": "Theme",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "lang.label": "Language",

  "request.method": "HTTP method",
  "request.url": "URL",
  "request.urlPlaceholder": "Enter a URL or paste a curl command (Ctrl+L)",
  "request.send": "Send",
  "request.cancel": "Cancel",
  "request.sendHint": "Ctrl+Enter to send",
  "request.cancelHint": "Esc to cancel",

  "tab.params": "Params",
  "tab.headers": "Headers",
  "tab.body": "Body",
  "tab.auth": "Auth",
  "tab.settings": "Settings",

  "kv.key": "Key",
  "kv.value": "Value",
  "kv.enabled": "Enabled",
  "kv.remove": "Remove",
  "kv.addKey": "Add key",
  "kv.addValue": "Value",

  "body.none": "None",
  "body.json": "JSON",
  "body.text": "Text",
  "body.noneHint": "This request has no body.",
  "body.format": "Format",
  "body.invalidJson": "Invalid JSON: {message}",
  "body.contentTypeHint": 'If Content-Type is not set, "{value}" is added automatically.',

  "auth.none": "None",
  "auth.basic": "Basic Auth",
  "auth.bearer": "Bearer Token",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.token": "Token",
  "auth.show": "Show",
  "auth.hide": "Hide",
  "auth.noneHint": "No authentication header is sent.",
  "auth.overrideHint": "Auth set here overrides any Authorization header entered manually.",
  "auth.storageHint":
    "Passwords and tokens are stored in Windows Credential Manager, never in the settings file.",

  "settings.timeout": "Timeout (seconds)",
  "settings.timeoutHint": "0 means no timeout. Maximum is {max} seconds.",

  "response.title": "Response",
  "response.empty": "Enter a URL and send a request to see the response here.",
  "response.sending": "Sending… {elapsed}",
  "response.time": "Time",
  "response.ttfb": "First byte {value}",
  "response.size": "Size",
  "response.pretty": "Pretty",
  "response.raw": "Raw",
  "response.headers": "Headers",
  "response.copy": "Copy",
  "response.copied": "Copied",
  "response.truncated": "The response is large. Only the first {size} is shown.",
  "response.binary": "The body contains data that is not valid UTF-8. It may be binary.",
  "response.invalidJson":
    "Content-Type is JSON, but the body could not be parsed as JSON: {message}",
  "response.prettySkipped": "The body is large, so it is shown without formatting.",
  "response.noBody": "No body.",

  "status.4xx": "Client error. Check the request.",
  "status.5xx": "Server error. Retry later or check the server logs.",
  "status.400": "Bad request. Check the body, parameters and Content-Type.",
  "status.401":
    "Authentication required. Check that the token or password is correct and not expired.",
  "status.403": "Access denied. You may be authenticated but lack permission.",
  "status.404": "Not found. Check the URL path and HTTP method.",
  "status.405": "This HTTP method is not allowed for the URL.",
  "status.408": "The server timed out waiting for the request.",
  "status.409": "Conflict with the current state of the resource.",
  "status.413": "The request body is too large.",
  "status.415": "Unsupported Content-Type. Check the headers.",
  "status.422":
    "The request is well-formed but invalid. See the error details in the response body.",
  "status.429": "Too many requests. If Retry-After is present, wait that long before retrying.",
  "status.500": "Internal server error. Check the server logs.",
  "status.502": "A gateway or proxy received an invalid response from the upstream server.",
  "status.503": "Service unavailable. The server may be under maintenance or overloaded.",
  "status.504": "A gateway or proxy timed out waiting for the upstream server.",

  "error.title": "The request could not be completed",
  "error.emptyUrl": "Enter a URL.",
  "error.invalidUrl": "The URL is not valid.",
  "error.unsupportedScheme":
    '"{scheme}:" is not supported. Use a URL starting with http:// or https://.',
  "error.invalidHeaderName": 'Header name "{name}" contains invalid characters.',
  "error.invalidHeaderValue":
    'The value of header "{name}" contains invalid characters (such as line breaks or non-ASCII).',
  "error.timeout": "Timed out after {seconds} seconds without a response.",
  "error.cancelled": "The request was cancelled.",
  "error.dns": "Could not resolve the host name. Check the URL and your network connection.",
  "error.connect":
    "Could not connect to the server. Check that it is running and the port is correct.",
  "error.tls":
    "Could not establish a secure (TLS) connection. The certificate may be invalid, expired or self-signed.",
  "error.tooManyRedirects": "Too many redirects. There may be a redirect loop.",
  "error.body": "The connection was interrupted while receiving the response body.",
  "error.other": "An unexpected error occurred during the request.",
  "error.details": "Details",

  "persist.tooLarge":
    "Credentials are too large to store in Credential Manager. You will need to re-enter them next time.",
  "persist.unavailable":
    "Credential Manager is unavailable, so credentials were not saved. You will need to re-enter them next time.",
};
