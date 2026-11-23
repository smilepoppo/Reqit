import { useI18n } from "../i18n";

export type NoticeTone = "info" | "warn" | "error";

export interface NoticeData {
  tone: NoticeTone;
  lines: string[];
}

const toneClass: Record<NoticeTone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  error:
    "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
};

/** 操作の結果を伝える、閉じられるお知らせ。 */
export function Notice({ notice, onClose }: { notice: NoticeData; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div
      role={notice.tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-md border px-3 py-2 text-xs ${toneClass[notice.tone]}`}
    >
      <ul className="flex-1 space-y-0.5">
        {notice.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <button type="button" onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100">
        {t("notice.close")}
      </button>
    </div>
  );
}
