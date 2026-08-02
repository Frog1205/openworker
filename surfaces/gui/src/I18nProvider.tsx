import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Locale, type MessageKey, type MessageValues } from "./i18n";

const STORAGE_KEY = "atlas:locale:v1";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
};

const I18nContext = createContext<I18nValue>({
  locale: "en-US",
  setLocale: () => {},
  t: (key, values) => translate("en-US", key, values),
});

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh-CN" || stored === "en-US") return stored;
  } catch {
    // Storage can be unavailable in hardened webviews; Chinese remains the product default.
  }
  return "zh-CN";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // In-memory switching still works when persistence is unavailable.
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (key, values) => translate(locale, key, values) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
