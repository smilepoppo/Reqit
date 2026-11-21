import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import type { RunState } from "../hooks/useRequestRunner";
import { errorDetail, errorMessage } from "../lib/errors";
import { formatBytes, formatDuration, headerValue, prettyBody } from "../lib/format";
import { statusHint, statusTone, type StatusTone } from "../lib/status";
import type { ResponseData } from "../lib/types";
import { CodeEditor } from "./CodeEditor";
import { Tabs } from "./Tabs";

type TabId = "pretty" | "raw" | "headers";

/** これより大きい本文は折り返さずに表示する（描画性能のため）。 */
const WRAP_LIMIT = 512 * 1024;

const toneClass: Record<StatusTone, string> = {
  info: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  redirect: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  clientError: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  serverError: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
};

function Elapsed({ startedAt }: { startedAt: number }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span role="status">
      {t("response.sending", { elapsed: formatDuration(Math.max(0, now - startedAt)) })}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="mr-2 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {copied ? t("response.copied") : t("response.copy")}
    </button>
  );
}

function ResponseView({ response, dark }: { response: ResponseData; dark: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("pretty");
  const contentType = headerValue(response.headers, "content-type");
  const pretty = useMemo(
    () => prettyBody(response.body, contentType),
    [response.body, contentType],
  );
  const hint = statusHint(response.status);
  const tone = statusTone(response.status);

  const notices: string[] = [];
  if (response.truncated)
    notices.push(t("response.truncated", { size: formatBytes(response.sizeBytes) }));
  if (!response.bodyIsUtf8) notices.push(t("response.binary"));
  if (pretty.jsonError) notices.push(t("response.invalidJson", { message: pretty.jsonError }));
  if (pretty.skippedPretty) notices.push(t("response.prettySkipped"));

  const headerText = response.headers.map(([k, v]) => `${k}: ${v}`).join("\n");
  const copyText = tab === "headers" ? headerText : tab === "raw" ? response.body : pretty.text;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
        <span
          data-testid="status"
          className={`rounded px-2 py-0.5 font-mono font-semibold ${toneClass[tone]}`}
        >
          {response.status} {response.statusText}
        </span>
        <span className="text-slate-600 dark:text-slate-300">
          <span className="text-slate-400">{t("response.time")} </span>
          <span
            data-testid="elapsed"
            title={t("response.ttfb", { value: formatDuration(response.ttfbMs) })}
          >
            {formatDuration(response.elapsedMs)}
          </span>
        </span>
        <span className="text-slate-600 dark:text-slate-300">
          <span className="text-slate-400">{t("response.size")} </span>
          <span data-testid="size">{formatBytes(response.sizeBytes)}</span>
        </span>
        <span className="text-xs text-slate-400">{response.httpVersion}</span>
      </div>
      {hint && (
        <p className="mx-3 mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t(hint)}
        </p>
      )}
      {notices.map((n) => (
        <p key={n} className="mx-3 mb-2 text-xs text-amber-700 dark:text-amber-400">
          {n}
        </p>
      ))}
      <Tabs
        items={[
          { id: "pretty", label: t("response.pretty") },
          { id: "raw", label: t("response.raw") },
          {
            id: "headers",
            label: `${t("response.headers")} (${response.headers.length})`,
          },
        ]}
        active={tab}
        onChange={setTab}
        label={t("response.title")}
        idPrefix="res"
        trailing={<CopyButton text={copyText} />}
      />
      <div
        id="res-panel"
        role="tabpanel"
        aria-labelledby={`res-tab-${tab}`}
        className="min-h-0 flex-1 overflow-auto"
      >
        {tab === "headers" ? (
          <table className="w-full table-fixed text-sm">
            <tbody>
              {response.headers.map(([k, v], i) => (
                <tr
                  key={`${k}-${i}`}
                  className="border-b border-slate-100 align-top dark:border-slate-800"
                >
                  <td className="w-2/5 px-3 py-1 font-mono text-[13px] break-all text-slate-500 dark:text-slate-400">
                    {k}
                  </td>
                  <td className="px-3 py-1 font-mono text-[13px] break-all select-text">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : response.body === "" ? (
          <p className="p-3 text-sm text-slate-500">{t("response.noBody")}</p>
        ) : (
          <CodeEditor
            value={tab === "raw" ? response.body : pretty.text}
            language={tab === "raw" ? "text" : pretty.language}
            readOnly
            wrap={response.body.length <= WRAP_LIMIT}
            dark={dark}
            ariaLabel={t("response.title")}
          />
        )}
      </div>
      {response.finalUrl && (
        <p
          className="truncate border-t border-slate-100 px-3 py-1 font-mono text-[11px] text-slate-400 dark:border-slate-800"
          title={response.finalUrl}
        >
          {response.finalUrl}
        </p>
      )}
    </div>
  );
}

export function ResponsePanel({ state, dark }: { state: RunState; dark: boolean }) {
  const { t } = useI18n();
  return (
    <section
      aria-label={t("response.title")}
      aria-busy={state.phase === "sending"}
      className="flex min-h-0 flex-1 flex-col"
    >
      {state.phase === "idle" && (
        <p className="m-auto max-w-xs p-6 text-center text-sm text-slate-500">
          {t("response.empty")}
        </p>
      )}
      {state.phase === "sending" && (
        <div className="m-auto flex items-center gap-3 p-6 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <Elapsed startedAt={state.startedAt} />
        </div>
      )}
      {state.phase === "error" && (
        <div
          role="alert"
          className="m-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/40"
        >
          <p className="font-semibold text-rose-800 dark:text-rose-300">
            {state.error.kind === "cancelled" ? t("error.cancelled") : t("error.title")}
          </p>
          {state.error.kind !== "cancelled" && (
            <p className="mt-1 text-rose-900 dark:text-rose-200">
              {(() => {
                const m = errorMessage(state.error);
                return t(m.key, m.params);
              })()}
            </p>
          )}
          {errorDetail(state.error) && (
            <details className="mt-2 text-xs text-rose-700 dark:text-rose-300">
              <summary className="cursor-pointer">{t("error.details")}</summary>
              <pre className="mt-1 font-mono break-all whitespace-pre-wrap">
                {errorDetail(state.error)}
              </pre>
            </details>
          )}
        </div>
      )}
      {state.phase === "done" && <ResponseView response={state.response} dark={dark} />}
    </section>
  );
}
