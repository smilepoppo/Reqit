<p align="center">
  <img src="public/reqit.svg" width="88" alt="Reqit">
</p>

<h1 align="center">Reqit</h1>

<p align="center">
  <b>Send. Inspect. Debug.</b><br>
  APIリクエストを、もっと手軽に。
</p>

<p align="center">
  <a href="README.md">日本語</a> | English
</p>

---

Reqit is a lightweight desktop app for quick API checks — for the times when launching Postman feels like overkill. The name comes from "Request it!".

- **No account required.** Everything stays on your machine. Nothing is synced to the cloud.
- **One screen.** Type a URL right after launch and see the request and the response side by side.
- **Japanese UI by default**, with an English UI available. Error causes are explained in plain language.
- **Lightweight.** Built with Tauri 2 and Microsoft Edge WebView2.

> [!NOTE]
> Reqit is at v0.1 (in development). Windows 11 is the first supported OS.

## Features (v0.1)

| Area     | Details                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Request  | GET / POST / PUT / PATCH / DELETE, URL, query params (synced with the URL bar), headers, body (JSON / text) |
| Auth     | Basic, Bearer token                                                                                         |
| Response | Status, headers, pretty view with JSON highlighting, raw view, timing, size                                 |
| Errors   | DNS / connection / TLS / timeout errors and HTTP status hints, explained in Japanese or English             |
| curl     | Paste "Copy as cURL" from browser dev tools into the URL bar to import; copy requests as curl (bash / cmd)  |
| Workflow | Cancel in-flight requests, timeout setting, automatic restore of the last request, dark / light mode        |

### Keyboard shortcuts

| Keys             | Action                                   |
| ---------------- | ---------------------------------------- |
| `Ctrl` + `Enter` | Send (also works while editing the body) |
| `Esc`            | Cancel the in-flight request             |
| `Ctrl` + `L`     | Focus the URL bar                        |

## Privacy and security

- Requests go directly from Reqit to your API server. No intermediate servers are involved.
- Passwords, tokens and values of headers such as `Authorization`, `Cookie` and `X-API-Key` are stored in Windows Credential Manager, never in the JSON settings file.
- TLS certificates are always verified.
- `Authorization` and `Cookie` headers are dropped automatically on cross-host redirects.

See [SECURITY.md](.github/SECURITY.md) for details.

## Installation

1. Open [GitHub Releases](https://github.com/smilepoppo/Reqit/releases) and download `Reqit_<version>_x64-setup.exe` from the latest release (an `.msi` package is also available).
2. Run the installer and follow the instructions. The `setup.exe` installer does not require administrator rights.
3. To uninstall, go to Windows Settings → Apps → Installed apps.

### If you see "Windows protected your PC"

Reqit is not code-signed yet, so Microsoft Defender SmartScreen may show a warning the first time you run it.

1. Verify the downloaded file (see "Verifying downloads" below).
2. Click "More info" on the warning.
3. Check that the publisher is shown as "Unknown publisher", then click "Run anyway".

We plan to apply for a free code signing service for open source projects.

### Verifying downloads

Each release includes `SHA256SUMS.txt`. Run the following in PowerShell and check that the hash matches the value in `SHA256SUMS.txt`.

```powershell
Get-FileHash .\Reqit_0.1.0_x64-setup.exe -Algorithm SHA256
```

Each release also includes an SBOM (list of libraries used, in SPDX format).

## Building from source (Windows 11)

Requirements: Microsoft C++ Build Tools, WebView2 Runtime (preinstalled on Windows 11), Rust stable (1.90+), Node.js 22+ and pnpm 10.

```powershell
git clone https://github.com/smilepoppo/Reqit.git
cd Reqit
pnpm install
pnpm tauri dev      # run in development mode
pnpm tauri build    # build installers (NSIS / MSI)
```

## Development

```sh
pnpm check                                             # typecheck, ESLint, Prettier, Vitest
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace                                 # tests against local mock servers
```

Architecture: [docs/architecture.md](docs/architecture.md) (Japanese). Roadmap and progress: [docs/plan.md](docs/plan.md). Contribution guide: [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## Roadmap

- **v0.1** API tester (current)
- **v0.2** curl import / export, request history, JSON diff, debug info export
- **v0.3** Built-in browser: capture requests made by web pages, then edit, resend and compare them
- **v0.4+** Timeline, JSONPath search, templates, local proxy capture and more

## License

Reqit is released under the [MIT License](LICENSE).

License texts of the open source software used by Reqit are available from "Licenses" at the top right of the app, and as `THIRD_PARTY_LICENSES.html` in each release.
