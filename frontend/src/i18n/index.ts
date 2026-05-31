import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE, type Locale } from '@vocab/shared'
import de from './messages/de.json'
import en from './messages/en.json'
import fr from './messages/fr.json'
import ja from './messages/ja.json'
import ko from './messages/ko.json'
import th from './messages/th.json'
import vi from './messages/vi.json'
import zh from './messages/zh.json'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: 'en',
  messages: {
    de,
    en,
    fr,
    ja,
    ko,
    th,
    vi,
    zh,
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
