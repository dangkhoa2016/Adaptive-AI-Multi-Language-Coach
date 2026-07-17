import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('useToast', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  it('show adds a toast with message and default type', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const { toasts, show } = useToast()
    show('Hello')
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].message).toBe('Hello')
    expect(toasts.value[0].type).toBe('info')
  })

  it('show adds a toast with specified type', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const { toasts, show } = useToast()
    show('Error!', 'error')
    expect(toasts.value[0].type).toBe('error')
  })

  it('dismiss removes a toast by id', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const { toasts, show, dismiss } = useToast()
    show('Test')
    const id = toasts.value[0].id
    dismiss(id)
    expect(toasts.value).toHaveLength(0)
  })

  it('auto-dismisses toast after 3 seconds', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const { toasts, show } = useToast()
    show('Auto dismiss')
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(3000)
    expect(toasts.value).toHaveLength(0)
  })

  it('dismiss does nothing for unknown id', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const { toasts, show, dismiss } = useToast()
    show('Test')
    dismiss(999)
    expect(toasts.value).toHaveLength(1)
  })

  it('each show call creates a unique id', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const { toasts, show } = useToast()
    show('First')
    show('Second')
    expect(toasts.value[0].id).not.toBe(toasts.value[1].id)
  })
})
