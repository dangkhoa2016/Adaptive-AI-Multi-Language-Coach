import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePrefsStore } from '../../src/stores/prefs'

describe('prefs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('has correct default state', () => {
    const store = usePrefsStore()
    expect(store.uiLocale).toBe('en')
    expect(store.source).toBe('en')
    expect(store.target).toBe('vi')
    expect(store.learningMode).toBe('mix')
  })

  it('mutates uiLocale', () => {
    const store = usePrefsStore()
    store.uiLocale = 'vi'
    expect(store.uiLocale).toBe('vi')
  })

  it('mutates source', () => {
    const store = usePrefsStore()
    store.source = 'ja'
    expect(store.source).toBe('ja')
  })

  it('mutates target', () => {
    const store = usePrefsStore()
    store.target = 'ko'
    expect(store.target).toBe('ko')
  })

  it('mutates learningMode', () => {
    const store = usePrefsStore()
    store.learningMode = 'word'
    expect(store.learningMode).toBe('word')
    store.learningMode = 'phrase'
    expect(store.learningMode).toBe('phrase')
  })

  it('has theme default of light', () => {
    const store = usePrefsStore()
    expect(store.theme).toBe('light')
  })

  it('toggleTheme switches to dark and back to light', () => {
    const store = usePrefsStore()
    store.toggleTheme()
    expect(store.theme).toBe('dark')
    store.toggleTheme()
    expect(store.theme).toBe('light')
  })
})
