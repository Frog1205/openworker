import zhCN from "./locales/zh-CN.json";
import enUS from "./locales/en-US.json";

export type Locale = "zh-CN" | "en-US";
type MessageKey = keyof typeof zhCN;

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

export function translate(
  locale: string,
  key: MessageKey,
  values: Record<string, string> = {},
): string {
  const catalog = catalogs[locale as Locale] || catalogs["zh-CN"];
  return Object.entries(values).reduce(
    (message, [name, value]) => message.split(`{${name}}`).join(value),
    catalog[key],
  );
}

export function missingTranslationKeys(): string[] {
  const required = Object.keys(zhCN);
  return required.filter((key) => !(key in enUS));
}
