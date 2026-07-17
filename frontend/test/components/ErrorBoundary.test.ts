import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'
import { defineComponent } from 'vue'
import ErrorBoundary from '../../src/components/ErrorBoundary.vue'
import en from '../../src/i18n/messages/en.json'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

const BadComponent = defineComponent({
  computed: {
    broken: (): string => {
      throw new Error('Test error message')
    },
  },
  template: '<p>{{ broken }}</p>',
})

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'home', component: { template: '<div>Home</div>' } }],
})

function mountComponent(slotContent?: string) {
  return mount(ErrorBoundary, {
    slots: { default: slotContent ?? '<p>Normal content</p>' },
    global: { plugins: [i18n, router] },
  })
}

describe('ErrorBoundary', () => {
  it('renders slot content when no error', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Normal content')
  })

  it('renders error state when child throws', async () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: BadComponent },
      global: { plugins: [i18n, router] },
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(wrapper.text()).toContain(en.common.error)
    expect(wrapper.text()).toContain('Test error message')
  })

  it('renders retry button in error state', async () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: BadComponent },
      global: { plugins: [i18n, router] },
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(wrapper.text()).toContain(en.common.retry)
  })

  it('renders back home button in error state', async () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: BadComponent },
      global: { plugins: [i18n, router] },
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(wrapper.text()).toContain(en.common.back_home)
  })
})
