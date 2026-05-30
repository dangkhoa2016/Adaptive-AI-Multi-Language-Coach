import type { Locale } from '@vocab/shared'

const LOCALE_TO_VOICE: Record<Locale, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  th: 'th-TH',
  zh: 'zh-CN',
  fr: 'fr-FR',
  de: 'de-DE',
}

export function useTTS() {
  function speak(text: string, locale: Locale) {
    if (!('speechSynthesis' in window)) return

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = LOCALE_TO_VOICE[locale] ?? 'en-US'
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
  }

  return { speak }
}
