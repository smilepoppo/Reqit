import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";

/** 同梱しているサードパーティのライセンス一覧を表示する。 */
export function LicensesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="licenses-title"
        className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-900"
      >
        <div className="flex items-center border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <h2 id="licenses-title" className="text-sm font-semibold">
            {t("about.licensesTitle")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="ml-auto rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t("about.close")}
          </button>
        </div>
        {import.meta.env.DEV ? (
          <p className="p-4 text-sm text-slate-500">{t("about.licensesDev")}</p>
        ) : (
          <iframe
            src="/third-party-licenses.html"
            title={t("about.licensesTitle")}
            className="min-h-0 flex-1 bg-white"
          />
        )}
      </div>
    </div>
  );
}
