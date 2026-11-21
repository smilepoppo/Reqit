import { createContext, useContext } from "react";
import { en } from "./en";
import { ja } from "./ja";

export type Lang = "ja" | "en";
export type MessageKey = keyof typeof ja;
export type Params = Record<string, string | number>;

const dictionaries: Record<Lang, Record<MessageKey, string>> = { ja, en };

export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const template = dictionaries[lang][key] ?? ja[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

export interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, params?: Params) => string;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
