import { describe, expect, it, vi } from 'vitest'
import { useLocale } from '../../src/composables/useLocale'

vi.mock('../../src/i18n', () => ({
  i18n: {
    global: {
      locale: { value: 'en' },
    },
  },
  loadLocaleMessages: vi.fn(),
}))

describe('useLocale', () => {
  it('setLocale updates locale value and loads messages', async () => {
    const { i18n, loadLocaleMessages } = await import('../../src/i18n')
    const { setLocale } = useLocale()

    await setLocale('vi')

    expect(i18n.global.locale.value).toBe('vi')
    expect(loadLocaleMessages).toHaveBeenCalledWith('vi')
  })

  it('returns a promise from loadLocaleMessages', async () => {
    const { loadLocaleMessages } = await import('../../src/i18n')
    vi.mocked(loadLocaleMessages).mockResolvedValueOnce(undefined)

    const { setLocale } = useLocale()
    const result = setLocale('fr')

    expect(result).toBeInstanceOf(Promise)
    await expect(result).resolves.toBeUndefined()
  })
})
