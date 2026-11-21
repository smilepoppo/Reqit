import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { readPref, writePref } from "../lib/prefs";
import { I18nContext, translate, type Lang, type MessageKey, type Params } from ".";

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (initial) return initial;
    return readPref("lang") === "en" ? "en" : "ja";
  });
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writePref("lang", l);
  }, []);
  const t = useCallback((key: MessageKey, params?: Params) => translate(lang, key, params), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
