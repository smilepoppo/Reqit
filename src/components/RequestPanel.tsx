import { useState } from "react";
import { useI18n } from "../i18n";
import {
  MAX_TIMEOUT_SEC,
  clampTimeout,
  type AuthType,
  type BodyType,
  type Draft,
} from "../lib/draft";
import { checkJson, formatJsonText } from "../lib/format";
import type { KeyValue, SecretPersistence } from "../lib/types";
import { urlFromRows } from "../lib/url";
import { CodeEditor } from "./CodeEditor";
import { KeyValueEditor } from "./KeyValueEditor";
import { Tabs } from "./Tabs";

type TabId = "params" | "headers" | "body" | "auth" | "settings";

interface Props {
  draft: Draft;
  update: (fn: (d: Draft) => Draft) => void;
  dark: boolean;
  secretStatus: SecretPersistence;
}

function countEnabled(rows: KeyValue[]): number {
  return rows.filter((r) => r.enabled && r.key !== "").length;
}

function Badge({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
      {n}
    </span>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded px-3 py-1 text-xs ${
            value === o.id
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const fieldClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900";

function SecretInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        className={fieldClass}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-pressed={visible}
      >
        {visible ? t("auth.hide") : t("auth.show")}
      </button>
    </div>
  );
}

export function RequestPanel({ draft, update, dark, secretStatus }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("params");
  const jsonCheck =
    draft.bodyType === "json" && draft.bodyText.trim() !== "" ? checkJson(draft.bodyText) : null;

  const tabs = [
    {
      id: "params" as const,
      label: (
        <>
          {t("tab.params")}
          <Badge n={countEnabled(draft.query)} />
        </>
      ),
    },
    {
      id: "headers" as const,
      label: (
        <>
          {t("tab.headers")}
          <Badge n={countEnabled(draft.headers)} />
        </>
      ),
    },
    { id: "body" as const, label: t("tab.body") },
    { id: "auth" as const, label: t("tab.auth") },
    { id: "settings" as const, label: t("tab.settings") },
  ];

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Request">
      <Tabs items={tabs} active={tab} onChange={setTab} label="Request" idPrefix="req" />
      <div
        id="req-panel"
        role="tabpanel"
        aria-labelledby={`req-tab-${tab}`}
        className="min-h-0 flex-1 overflow-auto p-3"
      >
        {tab === "params" && (
          <KeyValueEditor
            label={t("tab.params")}
            rows={draft.query}
            onChange={(rows) =>
              update((d) => ({ ...d, query: rows, url: urlFromRows(d.url, rows) }))
            }
          />
        )}

        {tab === "headers" && (
          <KeyValueEditor
            label={t("tab.headers")}
            rows={draft.headers}
            keyPlaceholder="Content-Type"
            onChange={(rows) => update((d) => ({ ...d, headers: rows }))}
          />
        )}

        {tab === "body" && (
          <div className="flex h-full min-h-48 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<BodyType>
                label={t("tab.body")}
                value={draft.bodyType}
                onChange={(v) => update((d) => ({ ...d, bodyType: v }))}
                options={[
                  { id: "none", label: t("body.none") },
                  { id: "json", label: t("body.json") },
                  { id: "text", label: t("body.text") },
                ]}
              />
              {draft.bodyType === "json" && (
                <button
                  type="button"
                  disabled={!jsonCheck?.valid}
                  onClick={() => update((d) => ({ ...d, bodyText: formatJsonText(d.bodyText) }))}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t("body.format")}
                </button>
              )}
            </div>
            {draft.bodyType === "none" ? (
              <p className="text-sm text-slate-500">{t("body.noneHint")}</p>
            ) : (
              <>
                <div className="min-h-40 flex-1 overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
                  <CodeEditor
                    value={draft.bodyText}
                    onChange={(v) => update((d) => ({ ...d, bodyText: v }))}
                    language={draft.bodyType === "json" ? "json" : "text"}
                    dark={dark}
                    placeholder={draft.bodyType === "json" ? '{\n  "name": "example"\n}' : ""}
                    ariaLabel={t("tab.body")}
                  />
                </div>
                {jsonCheck && !jsonCheck.valid && (
                  <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
                    {t("body.invalidJson", { message: jsonCheck.message })}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  {t("body.contentTypeHint", {
                    value:
                      draft.bodyType === "json" ? "application/json" : "text/plain; charset=utf-8",
                  })}
                </p>
              </>
            )}
          </div>
        )}

        {tab === "auth" && (
          <div className="flex max-w-lg flex-col gap-3">
            <Segmented<AuthType>
              label={t("tab.auth")}
              value={draft.authType}
              onChange={(v) => update((d) => ({ ...d, authType: v }))}
              options={[
                { id: "none", label: t("auth.none") },
                { id: "basic", label: t("auth.basic") },
                { id: "bearer", label: t("auth.bearer") },
              ]}
            />
            {draft.authType === "none" && (
              <p className="text-sm text-slate-500">{t("auth.noneHint")}</p>
            )}
            {draft.authType === "basic" && (
              <>
                <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {t("auth.username")}
                  <input
                    value={draft.username}
                    onChange={(e) => update((d) => ({ ...d, username: e.target.value }))}
                    autoComplete="off"
                    spellCheck={false}
                    className={fieldClass}
                  />
                </label>
                <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {t("auth.password")}
                  <SecretInput
                    label={t("auth.password")}
                    value={draft.password}
                    onChange={(v) => update((d) => ({ ...d, password: v }))}
                  />
                </div>
              </>
            )}
            {draft.authType === "bearer" && (
              <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                {t("auth.token")}
                <SecretInput
                  label={t("auth.token")}
                  value={draft.token}
                  onChange={(v) => update((d) => ({ ...d, token: v }))}
                />
              </div>
            )}
            {draft.authType !== "none" && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                <li>{t("auth.overrideHint")}</li>
                <li>{t("auth.storageHint")}</li>
              </ul>
            )}
            {(secretStatus === "tooLarge" || secretStatus === "unavailable") && (
              <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
                {t(secretStatus === "tooLarge" ? "persist.tooLarge" : "persist.unavailable")}
              </p>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="flex max-w-xs flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
            <label htmlFor="timeout-input">{t("settings.timeout")}</label>
            <input
              id="timeout-input"
              type="number"
              min={0}
              max={MAX_TIMEOUT_SEC}
              value={draft.timeoutSec}
              onChange={(e) =>
                update((d) => ({ ...d, timeoutSec: clampTimeout(Number(e.target.value)) }))
              }
              className={fieldClass}
            />
            <p className="text-slate-500">{t("settings.timeoutHint", { max: MAX_TIMEOUT_SEC })}</p>
          </div>
        )}
      </div>
    </section>
  );
}
