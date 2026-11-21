import { useCallback, useEffect, useRef, useState } from "react";
import { LicensesDialog } from "./components/LicensesDialog";
import { RequestBar } from "./components/RequestBar";
import { RequestPanel } from "./components/RequestPanel";
import { ResponsePanel } from "./components/ResponsePanel";
import { useI18n, type Lang } from "./i18n";
import { usePersistentDraft } from "./hooks/usePersistentDraft";
import { useRequestRunner } from "./hooks/useRequestRunner";
import { useTheme, type ThemePref } from "./hooks/useTheme";
import { applyUrlChange, draftToSpec } from "./lib/draft";
import { isTauri } from "./lib/ipc";

const selectClass =
  "rounded border border-slate-300 bg-transparent px-1.5 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900";

export default function App() {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref, dark } = useTheme();
  const { draft, update, secretStatus } = usePersistentDraft();
  const { state, send, cancel, sending } = useRequestRunner();
  const urlRef = useRef<HTMLInputElement>(null);
  const [showLicenses, setShowLicenses] = useState(false);
  const closeLicenses = useCallback(() => setShowLicenses(false), []);

  const doSend = useCallback(() => {
    void send(draftToSpec(draft));
  }, [draft, send]);

  // キャプチャ段階で受け取り、CodeMirror 内でも Ctrl+Enter で送信できるようにする。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!sending) doSend();
      } else if (e.key === "Escape" && sending) {
        e.preventDefault();
        cancel();
      } else if (mod && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        urlRef.current?.focus();
        urlRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [doSend, cancel, sending]);

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <img src="/reqit.svg" alt="" className="h-6 w-6" />
        <h1 className="text-base font-semibold tracking-tight">Reqit</h1>
        <span className="hidden text-xs text-slate-500 sm:inline">{t("app.tagline")}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLicenses(true)}
            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t("about.licenses")}
          </button>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <span className="sr-only">{t("lang.label")}</span>
            <select
              className={selectClass}
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label={t("lang.label")}
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </label>
          <select
            className={selectClass}
            value={pref}
            onChange={(e) => setPref(e.target.value as ThemePref)}
            aria-label={t("theme.label")}
          >
            <option value="system">{t("theme.system")}</option>
            <option value="light">{t("theme.light")}</option>
            <option value="dark">{t("theme.dark")}</option>
          </select>
        </div>
      </header>

      {!isTauri() && (
        <p className="bg-amber-100 px-4 py-1.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t("app.notTauri")}
        </p>
      )}

      <div className="px-4 pt-3 pb-2">
        <RequestBar
          urlRef={urlRef}
          method={draft.method}
          url={draft.url}
          sending={sending}
          onMethodChange={(m) => update((d) => ({ ...d, method: m }))}
          onUrlChange={(url) => update((d) => applyUrlChange(d, url))}
          onSend={doSend}
          onCancel={cancel}
        />
      </div>

      <main className="grid min-h-0 flex-1 grid-rows-2 gap-3 px-4 pb-4 lg:grid-cols-2 lg:grid-rows-1">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
          <RequestPanel draft={draft} update={update} dark={dark} secretStatus={secretStatus} />
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
          <ResponsePanel state={state} dark={dark} />
        </div>
      </main>
      {showLicenses && <LicensesDialog onClose={closeLicenses} />}
    </div>
  );
}
