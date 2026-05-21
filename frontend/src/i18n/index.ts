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
  const available = i18n.global.availableLocales as readonly string[]
  if (available.includes(locale)) return
  const messages = await import(`./messages/${locale}.json`)
  ;(i18n.global as { setLocaleMessage: (l: string, m: unknown) => void }).setLocaleMessage(
    locale,
    messages.default,
  )
}
