import type { Context } from 'hono'
import type { Locale } from '@vocab/shared'

import en from './messages/en.json'
import vi from './messages/vi.json'
import ja from './messages/ja.json'
import ko from './messages/ko.json'
import th from './messages/th.json'
import zh from './messages/zh.json'
import fr from './messages/fr.json'
import de from './messages/de.json'

const messages: Record<Locale, typeof en> = { en, vi, ja, ko, th, zh, fr, de }

/**
 * Translation helper that resolves a dot-notation key from the locale
 * dictionary attached to the current Hono context.
 *
 * Example: t(c, 'errors.rate_limited') → "Too many requests..."
 *          t(c, 'errors.ai_failed', { reason: 'timeout' }) → replaces {{reason}}
 */
export function t(c: Context, key: string, vars?: Record<string, string>): string {
  const locale = c.get('locale') as Locale
  const dict = messages[locale] ?? messages.en
  const segments = key.split('.')
  let value: unknown = dict
  for (const seg of segments) {
    if (value && typeof value === 'object' && seg in value) {
      value = (value as Record<string, unknown>)[seg]
    } else {
      // Fallback to English
      const fallback = messages.en
      let fb: unknown = fallback
      for (const s of segments) {
        if (fb && typeof fb === 'object' && s in fb) {
          fb = (fb as Record<string, unknown>)[s]
        } else {
          return key
        }
      }
      value = fb
      break
    }
  }
  if (typeof value !== 'string') return key
  if (!vars) return value
  let result = value
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, v)
  }
  return result
}
