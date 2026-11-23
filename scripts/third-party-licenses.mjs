#!/usr/bin/env node
// 配布物に含まれるサードパーティのライセンス文を 1 つの HTML にまとめる。
//
// - Rust：cargo-about（`cargo install cargo-about --locked --features cli`）で、
//   Windows 版に含まれる crate のライセンス文を集める（.config/about.toml を参照）
// - JavaScript：本番依存（pnpm licenses --prod）と、出力がアプリに含まれる
//   ビルドツール（Tailwind CSS）のライセンスファイルを読む
//
// 使い方: node scripts/third-party-licenses.mjs [出力先]
//   既定の出力先は public/third-party-licenses.html（Vite がアプリに同梱する）。
//   ライセンスファイルが見つからないパッケージがあれば、エラーで終了する。

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const OUT = resolve(process.argv[2] ?? "public/third-party-licenses.html");
const ROOT = resolve(".");

// ビルド時だけ使うが、生成物（CSS）がアプリに含まれるパッケージ。
const BUILD_OUTPUT_PACKAGES = ["tailwindcss"];

const escapeHtml = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function run(cmd, args) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === "win32",
  });
}

// --- Rust -----------------------------------------------------------------
function rustGroups() {
  // Windows の PowerShell では cargo-about が標準出力への書き出しを拒否するため、
  // 一時ファイルに出力してから読み込む。
  const dir = mkdtempSync(join(tmpdir(), "reqit-about-"));
  const file = join(dir, "about.json");
  let about;
  try {
    run("cargo", [
      "about",
      "generate",
      "--workspace",
      "--fail",
      "-c",
      ".config/about.toml",
      "--format",
      "json",
      "-o",
      file,
    ]);
    about = JSON.parse(readFileSync(file, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return about.licenses.map((l) => ({
    license: l.id,
    text: l.text.trim(),
    packages: [...new Set(l.used_by.map((u) => `${u.crate.name} ${u.crate.version}`))].sort(),
  }));
}

// --- JavaScript ------------------------------------------------------------
function licenseFiles(dir) {
  return readdirSync(dir)
    .filter((f) => /^(licen[cs]e|copying|notice)/i.test(f))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8").trim());
}

function jsGroups() {
  const data = JSON.parse(run("pnpm", ["licenses", "list", "--prod", "--json"]));
  const entries = Object.values(data).flat();
  for (const name of BUILD_OUTPUT_PACKAGES) {
    const pkgJson = join(ROOT, "node_modules", name, "package.json");
    const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
    entries.push({
      name,
      versions: [pkg.version],
      license: pkg.license,
      paths: [dirname(pkgJson)],
    });
  }

  const missing = [];
  const byText = new Map();
  for (const e of entries) {
    for (const p of e.paths ?? []) {
      const texts = licenseFiles(p);
      if (texts.length === 0) {
        missing.push(`${e.name} (${p})`);
        continue;
      }
      for (const text of texts) {
        const g = byText.get(text) ?? { license: e.license, text, packages: new Set() };
        for (const v of e.versions) g.packages.add(`${e.name} ${v}`);
        byText.set(text, g);
      }
    }
  }
  if (missing.length) {
    throw new Error(`ライセンスファイルが見つかりません:\n  ${missing.join("\n  ")}`);
  }
  return [...byText.values()].map((g) => ({ ...g, packages: [...g.packages].sort() }));
}

// --- HTML ------------------------------------------------------------------
function section(title, groups) {
  const count = new Set(groups.flatMap((g) => g.packages)).size;
  const items = groups
    .sort(
      (a, b) => a.license.localeCompare(b.license) || a.packages[0].localeCompare(b.packages[0]),
    )
    .map(
      (g) =>
        `<details><summary><b>${escapeHtml(g.license)}</b> — ${escapeHtml(g.packages.join(", "))}</summary><pre>${escapeHtml(g.text)}</pre></details>`,
    )
    .join("\n");
  return `<h2>${escapeHtml(title)}（${count}）</h2>\n${items}`;
}

const rust = rustGroups();
const js = jsGroups();
const ownLicense = readFileSync(join(ROOT, "LICENSE"), "utf8").trim();

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reqit - サードパーティのライセンス / Third-party licenses</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: "Segoe UI", "Yu Gothic UI", system-ui, sans-serif; margin: 0 auto; padding: 16px; max-width: 960px; line-height: 1.6; }
  h1 { font-size: 20px; } h2 { font-size: 16px; margin-top: 28px; }
  details { border-bottom: 1px solid #8884; padding: 6px 0; }
  summary { cursor: pointer; font-size: 13px; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; background: #8881; padding: 8px; }
</style>
</head>
<body>
<h1>サードパーティのライセンス / Third-party licenses</h1>
<p>Reqit は、次のオープンソースソフトウェアを利用しています。各ソフトウェアの著作権表示とライセンス文を掲載します。<br>
Reqit includes the following open source software. Their copyright notices and license texts are listed below.</p>
<p>MPL-2.0 のソフトウェアのソースコードは、各パッケージの配布元（crates.io）から入手できます。<br>
Source code of MPL-2.0 components is available from their distribution source (crates.io).</p>
<h2>Reqit</h2>
<pre>${escapeHtml(ownLicense)}</pre>
${section("Rust", rust)}
${section("JavaScript / CSS", js)}
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(
  `wrote ${OUT}: Rust ${new Set(rust.flatMap((g) => g.packages)).size} packages, JS ${new Set(js.flatMap((g) => g.packages)).size} packages, ${(html.length / 1024).toFixed(0)} KiB`,
);
if (!existsSync(OUT)) process.exit(1);
