export const SUPPORTED_LOCALES = ['en', 'vi', 'ja', 'ko', 'th', 'zh', 'fr', 'de'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  ja: '日本語',
  ko: '한국어',
  th: 'ไทย',
  zh: '中文',
  fr: 'Français',
  de: 'Deutsch',
}

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE
  const head = input.split(',')[0]?.trim().toLowerCase().split('-')[0] ?? ''
  return isLocale(head) ? head : DEFAULT_LOCALE
}
