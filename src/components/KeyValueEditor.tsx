import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import type { KeyValue } from "../lib/types";

interface Props {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  /** 一覧の用途（「ヘッダー」など）。スクリーンリーダー向けのラベルに使う。 */
  label: string;
  keyPlaceholder?: string;
}

const inputClass =
  "w-full min-w-0 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-[13px] outline-none hover:border-slate-300 focus:border-indigo-500 dark:hover:border-slate-600";

/**
 * キーと値の表。末尾には常に空行を表示し、入力すると新しい行として追加する。
 */
export function KeyValueEditor({ rows, onChange, label, keyPlaceholder }: Props) {
  const { t } = useI18n();
  const tableRef = useRef<HTMLTableElement>(null);
  // 追加用の行に入力したら、作成した行の同じ欄へフォーカスを移す。
  const pendingFocus = useRef<{ index: number; field: "key" | "value" } | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const input = tableRef.current?.querySelector<HTMLInputElement>(
      `input[data-row="${target.index}"][data-field="${target.field}"]`,
    );
    if (input) {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }, [rows]);

  const update = (index: number, patch: Partial<KeyValue>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const addFrom = (field: "key" | "value", text: string) => {
    pendingFocus.current = { index: rows.length, field };
    onChange([...rows, { key: "", value: "", enabled: true, [field]: text }]);
  };

  return (
    <table ref={tableRef} className="w-full table-fixed border-collapse text-sm" aria-label={label}>
      <thead>
        <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
          <th className="w-8 py-1 font-normal">
            <span className="sr-only">{t("kv.enabled")}</span>
          </th>
          <th className="w-2/5 px-2 py-1 font-normal">{t("kv.key")}</th>
          <th className="px-2 py-1 font-normal">{t("kv.value")}</th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          // 行は並べ替えないため、インデックスをキーにしても入力中のフォーカスは失われない。
          <tr key={i} className="group border-t border-slate-100 dark:border-slate-800">
            <td className="py-0.5 text-center">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => update(i, { enabled: e.target.checked })}
                aria-label={`${t("kv.enabled")}: ${row.key}`}
                className="accent-indigo-600"
              />
            </td>
            <td className="py-0.5">
              <input
                className={`${inputClass} ${row.enabled ? "" : "text-slate-400 line-through"}`}
                value={row.key}
                data-row={i}
                data-field="key"
                onChange={(e) => update(i, { key: e.target.value })}
                aria-label={`${label} ${t("kv.key")} ${i + 1}`}
                spellCheck={false}
              />
            </td>
            <td className="py-0.5">
              <input
                className={`${inputClass} ${row.enabled ? "" : "text-slate-400"}`}
                value={row.value}
                data-row={i}
                data-field="value"
                onChange={(e) => update(i, { value: e.target.value })}
                aria-label={`${label} ${t("kv.value")} ${i + 1}`}
                spellCheck={false}
              />
            </td>
            <td className="py-0.5 text-center">
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded px-1 text-slate-400 opacity-60 hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-800"
                aria-label={`${t("kv.remove")}: ${row.key || i + 1}`}
                title={t("kv.remove")}
              >
                ×
              </button>
            </td>
          </tr>
        ))}
        <tr className="border-t border-slate-100 dark:border-slate-800">
          <td />
          <td className="py-0.5">
            <input
              className={inputClass}
              value=""
              placeholder={keyPlaceholder ?? t("kv.addKey")}
              onChange={(e) => addFrom("key", e.target.value)}
              aria-label={`${label} ${t("kv.addKey")}`}
              spellCheck={false}
            />
          </td>
          <td className="py-0.5">
            <input
              className={inputClass}
              value=""
              placeholder={t("kv.addValue")}
              onChange={(e) => addFrom("value", e.target.value)}
              aria-label={`${label} ${t("kv.addValue")}`}
              spellCheck={false}
            />
          </td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}
