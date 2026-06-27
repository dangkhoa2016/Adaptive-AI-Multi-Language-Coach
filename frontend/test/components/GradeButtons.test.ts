import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import GradeButtons from '../../src/components/GradeButtons.vue'
import en from '../../src/i18n/messages/en.json'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(GradeButtons, {
    props: { disabled: false, ...props },
    global: { plugins: [i18n] },
  })
}

describe('GradeButtons', () => {
  it('renders 4 grade buttons', () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(4)
  })

  it('renders translatable labels on buttons', () => {
    const wrapper = mountComponent()
    const text = wrapper.text()
    expect(text).toContain(en.review.again)
    expect(text).toContain(en.review.hard)
    expect(text).toContain(en.review.good)
    expect(text).toContain(en.review.easy)
  })

  it('emits grade with correct quality value on click', () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    buttons[0].trigger('click')
    expect(wrapper.emitted('grade')).toBeTruthy()
    expect(wrapper.emitted('grade')![0]).toEqual([0])
    buttons[2].trigger('click')
    expect(wrapper.emitted('grade')![1]).toEqual([4])
  })

  it('disables all buttons when disabled prop is true', () => {
    const wrapper = mountComponent({ disabled: true })
    wrapper.findAll('button').forEach((btn) => {
      expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('emits grade on keyboard shortcut 1-4', () => {
    const wrapper = mountComponent()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
    expect(wrapper.emitted('grade')).toBeTruthy()
    expect(wrapper.emitted('grade')![0]).toEqual([0])
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }))
    expect(wrapper.emitted('grade')![1]).toEqual([5])
  })

  it('ignores keyboard shortcuts for out-of-range keys', () => {
    const wrapper = mountComponent()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }))
    expect(wrapper.emitted('grade')).toBeFalsy()
  })

  it('ignores repeated keydown events', () => {
    const wrapper = mountComponent()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', repeat: true }))
    expect(wrapper.emitted('grade')).toBeFalsy()
  })
})
