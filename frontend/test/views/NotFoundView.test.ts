import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'
import NotFoundView from '../../src/views/NotFoundView.vue'
import en from '../../src/i18n/messages/en.json'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }],
})

function mountComponent() {
  return mount(NotFoundView, {
    global: { plugins: [i18n, router] },
  })
}

describe('NotFoundView', () => {
  it('renders 404 heading', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('404')
  })

  it('renders not-found error message from i18n', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain(en.errors.not_found)
  })

  it('renders back home button', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain(en.common.back_home)
  })
})
