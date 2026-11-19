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

See [SECURITY.md](SECURITY.md) for details.

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

Architecture: [docs/architecture.md](docs/architecture.md) (Japanese). Roadmap and progress: [docs/plan.md](docs/plan.md). Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- **v0.1** API tester (current)
- **v0.2** curl import / export, request history, JSON diff, debug info export
- **v0.3** Built-in browser: capture requests made by web pages, then edit, resend and compare them
- **v0.4+** Timeline, JSONPath search, templates, local proxy capture and more

## License

[MIT License](LICENSE)
