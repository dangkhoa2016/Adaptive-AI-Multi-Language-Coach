import { i18n, loadLocaleMessages } from '../i18n'
import type { Locale } from '@vocab/shared'

export function useLocale() {
  function setLocale(locale: Locale) {
    i18n.global.locale.value = locale
    return loadLocaleMessages(locale)
  }

  return { setLocale }
}
