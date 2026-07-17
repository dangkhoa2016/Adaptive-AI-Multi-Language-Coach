import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import EmptyState from '../../src/components/EmptyState.vue'
import en from '../../src/i18n/messages/en.json'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(EmptyState, {
    props,
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('EmptyState', () => {
  it('renders title', () => {
    const wrapper = mountComponent({ title: 'No items found' })
    expect(wrapper.text()).toContain('No items found')
  })

  it('renders icon when provided', () => {
    const wrapper = mountComponent({ icon: '📚', title: 'Empty' })
    expect(wrapper.text()).toContain('📚')
  })

  it('renders description when provided', () => {
    const wrapper = mountComponent({ title: 'Empty', description: 'Add some items to get started' })
    expect(wrapper.text()).toContain('Add some items to get started')
  })

  it('renders action link when actionLabel and actionLink are provided', () => {
    const wrapper = mountComponent({
      title: 'Empty',
      actionLabel: 'Go home',
      actionLink: '/',
    })
    expect(wrapper.text()).toContain('Go home')
    expect(wrapper.find('a').exists()).toBe(true)
  })

  it('does not render icon when not provided', () => {
    const wrapper = mountComponent({ title: 'Empty' })
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('does not render description when not provided', () => {
    const wrapper = mountComponent({ title: 'Empty' })
    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('does not render action link when actionLabel is missing', () => {
    const wrapper = mountComponent({ title: 'Empty', actionLink: '/' })
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
