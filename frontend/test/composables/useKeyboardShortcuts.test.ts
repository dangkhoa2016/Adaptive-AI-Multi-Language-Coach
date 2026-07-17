import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useKeyboardShortcuts } from '../../src/composables/useKeyboardShortcuts'

function createTestComponent(shortcuts: Record<string, () => void>) {
  return defineComponent({
    setup() {
      useKeyboardShortcuts(shortcuts)
      return {}
    },
    template: '<div />',
  })
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the mapped function on keydown', () => {
    const fn = vi.fn()
    mount(createTestComponent({ a: fn }))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not call the function for unmapped keys', () => {
    const fn = vi.fn()
    mount(createTestComponent({ a: fn }))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))

    expect(fn).not.toHaveBeenCalled()
  })

  it('ignores events from INPUT elements', () => {
    const fn = vi.fn()
    mount(createTestComponent({ Enter: fn }))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    document.body.removeChild(input)

    expect(fn).not.toHaveBeenCalled()
  })

  it('ignores events from TEXTAREA elements', () => {
    const fn = vi.fn()
    mount(createTestComponent({ Enter: fn }))

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    document.body.removeChild(textarea)

    expect(fn).not.toHaveBeenCalled()
  })

  it('ignores events from SELECT elements', () => {
    const fn = vi.fn()
    mount(createTestComponent({ Enter: fn }))

    const select = document.createElement('select')
    document.body.appendChild(select)
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    document.body.removeChild(select)

    expect(fn).not.toHaveBeenCalled()
  })

  it('removes the event listener on unmount', () => {
    const fn = vi.fn()
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const wrapper = mount(createTestComponent({ a: fn }))
    const handler = addSpy.mock.calls.find(([e]) => e === 'keydown')?.[1]

    wrapper.unmount()

    expect(removeSpy).toHaveBeenCalledWith('keydown', handler)
  })

  it('calls preventDefault on matched shortcuts', () => {
    const fn = vi.fn()
    mount(createTestComponent({ ' ': fn }))

    const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(preventSpy).toHaveBeenCalled()
  })
})
