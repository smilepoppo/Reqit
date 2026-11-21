#!/usr/bin/env node
// 実際の Reqit アプリを WebDriver（tauri-driver）で操作するスモークテスト。
//
// 前提（Linux）:
//   - `pnpm tauri build --no-bundle` でビルド済み（target/release/reqit）
//   - tauri-driver と WebKitWebDriver がインストール済み
//   - X ディスプレイがある（CI やヘッドレス環境では xvfb-run で実行する）
//
// 使い方: xvfb-run -a node scripts/e2e-smoke.mjs [スクリーンショットの保存先ディレクトリ]
//
// 外部ネットワークには接続せず、ローカルのモック HTTP サーバーとだけ通信する。

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const APP = resolve(process.env.REQIT_APP ?? "target/release/reqit");
const OUT = resolve(process.argv[2] ?? ".test-tmp/e2e");
const DRIVER = "http://127.0.0.1:4444";
mkdirSync(OUT, { recursive: true });

// --- モック API サーバー ---
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/users") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        page: Number(url.searchParams.get("page") ?? 1),
        method: req.method,
        auth: req.headers.authorization ?? null,
        users: [{ id: 1, name: "テスト太郎" }],
      }),
    );
  } else if (url.pathname === "/big") {
    // 1 行の巨大な JSON（整形の上限を超えるサイズも試す）
    const n = Number(url.searchParams.get("n") ?? 1000);
    const items = Array.from({ length: n }, (_, i) => ({
      id: i,
      name: `item-${i}`,
      tags: ["a", "b"],
    }));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(items));
  } else if (url.pathname === "/slow") {
    setTimeout(() => res.end("late"), 15_000);
  } else {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// --- WebDriver ヘルパー ---
async function wd(method, path, body) {
  const res = await fetch(DRIVER + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json.value)}`);
  return json.value;
}
const ELEMENT = "element-6066-11e4-a52e-4f735a3d3d2f";
let elementKey = ELEMENT;

async function session() {
  const v = await wd("POST", "/session", {
    capabilities: { alwaysMatch: { "tauri:options": { application: APP } } },
  });
  return v.sessionId;
}
async function find(sid, css, timeoutMs = 10_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      const v = await wd("POST", `/session/${sid}/element`, { using: "css selector", value: css });
      // WebDriver 実装によって要素 ID のキー名が異なるため、返ってきたキーを覚えておく。
      elementKey = ELEMENT in v ? ELEMENT : Object.keys(v)[0];
      return v[elementKey];
    } catch (e) {
      if (Date.now() > until) throw e;
      await sleep(100);
    }
  }
}
const click = (sid, el) => wd("POST", `/session/${sid}/element/${el}/click`, {});
const type = (sid, el, text) => wd("POST", `/session/${sid}/element/${el}/value`, { text });
const text = (sid, el) => wd("GET", `/session/${sid}/element/${el}/text`);
const prop = (sid, el, name) => wd("GET", `/session/${sid}/element/${el}/property/${name}`);
async function screenshot(sid, name) {
  const b64 = await wd("GET", `/session/${sid}/screenshot`);
  writeFileSync(resolve(OUT, name), Buffer.from(b64, "base64"));
}
async function clearUrl(sid, el) {
  // React の制御コンポーネントでも確実に消えるよう、全選択して削除する。
  await click(sid, el);
  await type(sid, el, "a");
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const driver = spawn("tauri-driver", [], { stdio: "ignore" });
let sid;
try {
  await sleep(1500);

  // 1. 起動して送信
  const t0 = Date.now();
  sid = await session();
  const url = await find(sid, 'input[aria-label="URL"]');
  check(
    "startup",
    true,
    `${Date.now() - t0} ms until URL input is available (WebDriver overhead included)`,
  );
  await clearUrl(sid, url);
  await type(sid, url, `${base}/api/users?page=2`);
  await click(sid, await find(sid, 'button[type="submit"]'));
  const status = await text(sid, await find(sid, '[data-testid="status"]'));
  check("GET returns 200", status.startsWith("200"), status);
  const body = await text(sid, await find(sid, "#res-panel"));
  check("JSON body shown", body.includes("テスト太郎") && body.includes('"page": 2'), "");
  await screenshot(sid, "01-response.png");

  // 2. 404 のヒント
  await clearUrl(sid, url);
  await type(sid, url, `${base}/missing`);
  await click(sid, await find(sid, 'button[type="submit"]'));
  await sleep(500);
  const s404 = await text(sid, await find(sid, '[data-testid="status"]'));
  check("404 shown", s404.startsWith("404"), s404);

  // 3. 接続エラー
  await clearUrl(sid, url);
  await type(sid, url, "http://127.0.0.1:9/");
  await click(sid, await find(sid, 'button[type="submit"]'));
  const alert = await text(sid, await find(sid, '[role="alert"]'));
  check(
    "connection error is readable",
    alert.includes("接続できませんでした"),
    alert.split("\n")[0],
  );
  await screenshot(sid, "02-error.png");

  // 4. キャンセル
  await clearUrl(sid, url);
  await type(sid, url, `${base}/slow`);
  await click(sid, await find(sid, 'button[type="submit"]'));
  await sleep(300);
  await click(sid, await find(sid, 'button[type="button"][title*="Esc"]'));
  const cancelled = await text(sid, await find(sid, '[role="alert"]'));
  check("cancel works", cancelled.includes("キャンセル"), cancelled.split("\n")[0]);

  // 5. 大きなレスポンス（約 3 MB は整形、約 15 MB は整形を省略）
  for (const [n, label] of [
    [60_000, "~3MB"],
    [300_000, "~15MB"],
  ]) {
    await clearUrl(sid, url);
    await type(sid, url, `${base}/big?n=${n}`);
    const started = Date.now();
    await click(sid, await find(sid, 'button[type="submit"]'));
    const st = await text(sid, await find(sid, '[data-testid="status"]', 60_000));
    const size = await text(sid, await find(sid, '[data-testid="size"]'));
    const ms = Date.now() - started;
    // 描画後も UI が応答するか（タブ切り替えができるか）を確認する
    await click(sid, await find(sid, "#res-tab-headers"));
    const headersTab = await text(sid, await find(sid, "#res-panel"));
    check(
      `large response ${label}`,
      st.startsWith("200") && headersTab.includes("content-type"),
      `${size}, rendered in ${ms} ms`,
    );
    await click(sid, await find(sid, "#res-tab-pretty"));
  }
  await screenshot(sid, "04-large.png");

  // 6. サードパーティのライセンス一覧（生成済みのビルドでのみ確認する）
  if (existsSync("public/third-party-licenses.html")) {
    await click(sid, await find(sid, "header button"));
    const frame = await find(sid, 'div[role="dialog"] iframe');
    await wd("POST", `/session/${sid}/frame`, { id: { [elementKey]: frame } });
    const heading = await text(sid, await find(sid, "h1"));
    const body = await text(sid, await find(sid, "body"));
    await wd("POST", `/session/${sid}/frame`, { id: null });
    check(
      "third-party licenses shown",
      heading.includes("サードパーティのライセンス") &&
        body.includes("reqwest") &&
        body.includes("react"),
      heading,
    );
    await screenshot(sid, "05-licenses.png");
    await click(sid, await find(sid, 'div[role="dialog"] button'));
  } else {
    console.log("SKIP third-party licenses (public/third-party-licenses.html not generated)");
  }

  // 7. 前回入力の復元（保存は 600 ms の遅延後）
  await clearUrl(sid, url);
  await type(sid, url, `${base}/api/users?page=7`);
  await sleep(1500);
  await wd("DELETE", `/session/${sid}`);
  sid = await session();
  const url2 = await find(sid, 'input[aria-label="URL"]');
  await sleep(800);
  const restored = await prop(sid, url2, "value");
  check("last request restored", restored === `${base}/api/users?page=7`, restored);
  await screenshot(sid, "03-restored.png");
} catch (e) {
  check("unexpected error", false, String(e));
} finally {
  if (sid) await wd("DELETE", `/session/${sid}`).catch(() => {});
  driver.kill();
  server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed. Screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
