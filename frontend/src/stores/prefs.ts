import { defineStore } from 'pinia'
import { DEFAULT_LOCALE, type Locale } from '@vocab/shared'

interface PrefsState {
  uiLocale: Locale
  source: Locale
  target: Locale
  learningMode: 'word' | 'phrase' | 'mix'
}

export const usePrefsStore = defineStore('prefs', {
  state: (): PrefsState => ({
    uiLocale: DEFAULT_LOCALE,
    source: 'en',
    target: 'vi',
    learningMode: 'mix',
  }),
  persist: {
    key: 'vocab.prefs',
  },
})
