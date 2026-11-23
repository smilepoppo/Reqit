// React から IPC 経由で送信する流れの結合テスト。Tauri の invoke をモックする。
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import type { RequestSpec, ResponseData } from "./lib/types";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isTauri: () => true,
}));

const okResponse: ResponseData = {
  status: 200,
  statusText: "OK",
  httpVersion: "HTTP/1.1",
  headers: [["content-type", "application/json"]],
  body: '{"id":1,"name":"Reqit"}',
  bodyIsUtf8: true,
  sizeBytes: 23,
  truncated: false,
  ttfbMs: 10,
  elapsedMs: 42,
  finalUrl: "https://api.example.com/users?page=2",
};

type Handler = (cmd: string, args: Record<string, unknown>) => unknown;

function setup(handler: Handler, lastRequest: RequestSpec | null = null) {
  invoke.mockImplementation(async (cmd: string, args: Record<string, unknown> = {}) => {
    if (cmd === "load_last_request") return lastRequest;
    if (cmd === "save_last_request") return { secrets: "none" };
    return handler(cmd, args);
  });
  return render(
    <I18nProvider initial="ja">
      <App />
    </I18nProvider>,
  );
}

function callsTo(cmd: string) {
  return invoke.mock.calls.filter((c) => c[0] === cmd);
}

beforeEach(() => {
  invoke.mockReset();
});

describe("App", () => {
  it("sends a request through IPC and shows the response", async () => {
    const user = userEvent.setup();
    setup(async (cmd) => (cmd === "send_request" ? okResponse : undefined));

    const url = await screen.findByLabelText("URL");
    await user.type(url, "https://api.example.com/users?page=2");
    expect(screen.getByRole("tab", { name: /パラメーター/ })).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(await screen.findByTestId("status")).toHaveTextContent("200 OK");
    expect(screen.getByTestId("elapsed")).toHaveTextContent("42 ms");
    expect(screen.getByTestId("size")).toHaveTextContent("23 B");

    const [, args] = callsTo("send_request")[0]!;
    const { requestId, spec } = args as { requestId: string; spec: RequestSpec };
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(spec.method).toBe("GET");
    expect(spec.url).toBe("https://api.example.com/users");
    expect(spec.query).toEqual([{ key: "page", value: "2", enabled: true }]);
  });

  it("sends with Ctrl+Enter", async () => {
    const user = userEvent.setup();
    setup(async (cmd) => (cmd === "send_request" ? okResponse : undefined));
    await user.type(await screen.findByLabelText("URL"), "example.com");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await screen.findByTestId("status");
    expect(callsTo("send_request")).toHaveLength(1);
  });

  it("shows a Japanese error message without crashing", async () => {
    const user = userEvent.setup();
    setup(async (cmd) => {
      if (cmd === "send_request") throw { kind: "connect", detail: "connection refused" };
    });
    await user.type(await screen.findByLabelText("URL"), "http://localhost:9");
    await user.click(screen.getByRole("button", { name: "送信" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("サーバーに接続できませんでした");
    expect(alert).toHaveTextContent("connection refused");
    // 再送信できる状態に戻っている。
    expect(screen.getByRole("button", { name: "送信" })).toBeEnabled();
  });

  it("shows a hint for HTTP error statuses", async () => {
    const user = userEvent.setup();
    setup(async (cmd) =>
      cmd === "send_request"
        ? { ...okResponse, status: 401, statusText: "Unauthorized", body: "" }
        : undefined,
    );
    await user.type(await screen.findByLabelText("URL"), "https://api.example.com");
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(await screen.findByTestId("status")).toHaveTextContent("401 Unauthorized");
    expect(screen.getByText(/認証が必要です/)).toBeInTheDocument();
  });

  it("cancels an in-flight request", async () => {
    const user = userEvent.setup();
    let reject: (e: unknown) => void = () => {};
    setup((cmd) => {
      if (cmd === "send_request")
        return new Promise((_, r) => {
          reject = r;
        });
      if (cmd === "cancel_request") {
        reject({ kind: "cancelled" });
        return true;
      }
    });
    await user.type(await screen.findByLabelText("URL"), "https://slow.example.com");
    await user.click(screen.getByRole("button", { name: "送信" }));
    await user.click(await screen.findByRole("button", { name: "キャンセル" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("キャンセルしました");
    const sendId = (callsTo("send_request")[0]![1] as { requestId: string }).requestId;
    expect(callsTo("cancel_request")[0]![1]).toEqual({ requestId: sendId });
  });

  it("cancels with Esc and focuses the URL bar with Ctrl+L", async () => {
    const user = userEvent.setup();
    let reject: (e: unknown) => void = () => {};
    setup((cmd) => {
      if (cmd === "send_request")
        return new Promise((_, r) => {
          reject = r;
        });
      if (cmd === "cancel_request") {
        reject({ kind: "cancelled" });
        return true;
      }
    });
    const url = await screen.findByLabelText("URL");
    await user.type(url, "https://slow.example.com");
    await user.click(screen.getByRole("tab", { name: "ヘッダー" }));
    expect(url).not.toHaveFocus();
    await user.keyboard("{Control>}l{/Control}");
    expect(url).toHaveFocus();

    await user.keyboard("{Control>}{Enter}{/Control}");
    await screen.findByRole("button", { name: "キャンセル" });
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("alert")).toHaveTextContent("キャンセルしました");
    expect(callsTo("cancel_request")).toHaveLength(1);
  });

  it("restores the last request on startup", async () => {
    setup(async () => undefined, {
      method: "POST",
      url: "https://api.example.com/items",
      query: [
        { key: "a", value: "1", enabled: true },
        { key: "b", value: "2", enabled: false },
      ],
      headers: [],
      body: { type: "json", text: "{}" },
      auth: { type: "none" },
      timeoutMs: 10_000,
    });
    await waitFor(() =>
      expect(screen.getByLabelText("URL")).toHaveValue("https://api.example.com/items?a=1"),
    );
    expect(screen.getByLabelText("HTTPメソッド")).toHaveValue("POST");
  });

  it("saves the draft via IPC and never writes secrets to localStorage", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      setup(async () => undefined);
      await user.type(await screen.findByLabelText("URL"), "https://api.example.com");
      await user.click(screen.getByRole("tab", { name: "認証" }));
      await user.click(screen.getByRole("radio", { name: "Bearerトークン" }));
      await user.type(screen.getByLabelText("トークン"), "dummy-secret-token");
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await waitFor(() => expect(callsTo("save_last_request").length).toBeGreaterThan(0));
      const last = callsTo("save_last_request").at(-1)![1] as { spec: RequestSpec };
      expect(last.spec.auth).toEqual({ type: "bearer", token: "dummy-secret-token" });
      expect(JSON.stringify({ ...window.localStorage })).not.toContain("dummy-secret-token");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens and closes the third-party licenses dialog", async () => {
    const user = userEvent.setup();
    setup(async () => undefined);
    await user.click(await screen.findByRole("button", { name: "ライセンス" }));
    const dialog = screen.getByRole("dialog", { name: "サードパーティのライセンス" });
    expect(dialog).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("imports a pasted curl command into the request", async () => {
    const user = userEvent.setup();
    setup(async (cmd, args) => {
      if (cmd === "parse_curl") {
        expect(args.input).toContain("curl ");
        return {
          spec: {
            method: "POST",
            url: "https://api.example.com/items",
            query: [{ key: "lang", value: "ja", enabled: true }],
            headers: [{ key: "accept", value: "*/*", enabled: true }],
            body: { type: "json", text: '{"a":1}' },
            auth: { type: "none" },
            timeoutMs: 30000,
          },
          warnings: [{ kind: "insecureIgnored" }],
        };
      }
    });
    const url = await screen.findByLabelText("URL");
    await user.click(url);
    await user.paste("curl -k 'https://api.example.com/items?lang=ja' --data-raw '{\"a\":1}'");
    await waitFor(() => expect(url).toHaveValue("https://api.example.com/items?lang=ja"));
    expect(screen.getByLabelText("HTTPメソッド")).toHaveValue("POST");
    const status = screen.getByRole("status", { name: "" });
    expect(status).toHaveTextContent("curl コマンドを読み込みました。");
    expect(status).toHaveTextContent("TLS 証明書の検証を無効にしません");
  });

  it("shows a readable error for an invalid curl command", async () => {
    const user = userEvent.setup();
    setup(async (cmd) => {
      if (cmd === "parse_curl") throw { kind: "unterminatedQuote" };
    });
    await user.click(await screen.findByLabelText("URL"));
    await user.paste("curl 'https://example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent("引用符が閉じられていません");
  });

  it("copies the request as a curl command", async () => {
    const user = userEvent.setup();
    setup(async (cmd, args) => {
      if (cmd === "export_curl") {
        expect(args.style).toBe("cmd");
        return 'curl ^"https://example.com/^"';
      }
    });
    await user.type(await screen.findByLabelText("URL"), "https://example.com/");
    await user.selectOptions(screen.getByLabelText("curl をコピー"), "cmd");
    await waitFor(() => expect(callsTo("export_curl")).toHaveLength(1));
    expect(await navigator.clipboard.readText()).toBe('curl ^"https://example.com/^"');
    expect(screen.getByText(/curl コマンドをコピーしました/)).toBeInTheDocument();
  });

  it("switches the UI language to English", async () => {
    const user = userEvent.setup();
    setup(async () => undefined);
    await user.selectOptions(await screen.findByLabelText("言語"), "en");
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});
