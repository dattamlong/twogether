import { en } from "./en";
import { vi } from "./vi";

export type MessageKey = keyof typeof en;
export type Locale = "en" | "vi";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, vi };

export const PRIMARY_LOCALE: Locale = "en";
export const SUPPORT_LOCALE: Locale = "vi";

export function t(key: MessageKey, locale: Locale = PRIMARY_LOCALE) {
  return dictionaries[locale][key] ?? dictionaries.en[key];
}

export function bilingual(key: MessageKey) {
  return { primary: t(key, PRIMARY_LOCALE), support: t(key, SUPPORT_LOCALE) };
}
