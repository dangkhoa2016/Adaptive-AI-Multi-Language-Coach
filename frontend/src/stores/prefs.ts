import { defineStore } from 'pinia'
import { DEFAULT_LOCALE, type Locale } from '@vocab/shared'

interface PrefsState {
  uiLocale: Locale
  source: Locale
  target: Locale
  learningMode: 'word' | 'phrase' | 'mix'
  theme: 'light' | 'dark'
}

export const usePrefsStore = defineStore('prefs', {
  state: (): PrefsState => ({
    uiLocale: DEFAULT_LOCALE,
    source: 'en',
    target: 'vi',
    learningMode: 'mix',
    theme: 'light',
  }),
  actions: {
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
    },
  },
  persist: {
    key: 'vocab.prefs',
  },
})
