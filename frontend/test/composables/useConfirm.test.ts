import { describe, expect, it, beforeEach } from 'vitest'
import { useConfirm } from '../../src/composables/useConfirm'

describe('useConfirm', () => {
  beforeEach(() => {
    const { resolveConfirm } = useConfirm()
    resolveConfirm(false)
  })

  it('returns null state initially', () => {
    const { state } = useConfirm()
    expect(state.value).toBeNull()
  })

  it('sets state when confirm() is called', () => {
    const { confirm, state } = useConfirm()
    const promise = confirm({ title: 'Test', message: 'Test message' })
    expect(state.value).not.toBeNull()
    expect(state.value!.options.title).toBe('Test')
    expect(state.value!.options.message).toBe('Test message')
    expect(promise).toBeInstanceOf(Promise)
  })

  it('resolves promise with true', async () => {
    const { confirm, resolveConfirm } = useConfirm()
    const promise = confirm({ title: 'T', message: 'M' })
    resolveConfirm(true)
    await expect(promise).resolves.toBe(true)
  })

  it('resolves promise with false', async () => {
    const { confirm, resolveConfirm } = useConfirm()
    const promise = confirm({ title: 'T', message: 'M' })
    resolveConfirm(false)
    await expect(promise).resolves.toBe(false)
  })

  it('clears state after resolve', () => {
    const { confirm, resolveConfirm, state } = useConfirm()
    confirm({ title: 'T', message: 'M' })
    resolveConfirm(true)
    expect(state.value).toBeNull()
  })
})
