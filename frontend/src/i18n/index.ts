import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE, type Locale } from '@vocab/shared'
import en from './messages/en.json'
import vi from './messages/vi.json'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: 'en',
  messages: {
    en,
    vi,
  },
})

export async function loadLocaleMessages(locale: Locale) {
  const available = i18n.global.availableLocales as string[]
  if (available.includes(locale)) return
  try {
    const messages = await import(`./messages/${locale}.json`)
    i18n.global.setLocaleMessage(locale, messages.default)
  } catch {
    console.warn(`Failed to load locale: ${locale}, falling back to en`)
  }
}
