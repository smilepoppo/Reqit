import type { ClipboardEvent, Ref } from "react";
import { useI18n } from "../i18n";
import { HTTP_METHODS, type HttpMethod } from "../lib/types";

interface Props {
  method: HttpMethod;
  url: string;
  sending: boolean;
  onMethodChange: (m: HttpMethod) => void;
  onUrlChange: (url: string) => void;
  onSend: () => void;
  onCancel: () => void;
  urlRef?: Ref<HTMLInputElement>;
  onUrlPaste?: (e: ClipboardEvent<HTMLInputElement>) => void;
}

const methodColor: Record<HttpMethod, string> = {
  GET: "text-emerald-600 dark:text-emerald-400",
  POST: "text-amber-600 dark:text-amber-400",
  PUT: "text-sky-600 dark:text-sky-400",
  PATCH: "text-violet-600 dark:text-violet-400",
  DELETE: "text-rose-600 dark:text-rose-400",
};

export function RequestBar({
  method,
  url,
  sending,
  onMethodChange,
  onUrlChange,
  onSend,
  onCancel,
  urlRef,
  onUrlPaste,
}: Props) {
  const { t } = useI18n();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!sending) onSend();
      }}
    >
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900">
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
          aria-label={t("request.method")}
          className={`border-r border-slate-200 bg-transparent px-3 font-mono text-sm font-semibold outline-none dark:border-slate-700 ${methodColor[method]}`}
        >
          {HTTP_METHODS.map((m) => (
            <option
              key={m}
              value={m}
              className="text-slate-900 dark:bg-slate-900 dark:text-slate-100"
            >
              {m}
            </option>
          ))}
        </select>
        <input
          ref={urlRef}
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onPaste={onUrlPaste}
          placeholder={t("request.urlPlaceholder")}
          aria-label={t("request.url")}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      {sending ? (
        <button
          type="button"
          onClick={onCancel}
          title={t("request.cancelHint")}
          className="rounded-md bg-slate-600 px-5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {t("request.cancel")}
        </button>
      ) : (
        <button
          type="submit"
          title={t("request.sendHint")}
          className="rounded-md bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:outline-none"
        >
          {t("request.send")}
        </button>
      )}
    </form>
  );
}
