import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import OnboardingBanner from '../../src/components/OnboardingBanner.vue'
import en from '../../src/i18n/messages/en.json'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

beforeAll(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

function mountComponent() {
  return mount(OnboardingBanner, {
    global: { plugins: [i18n] },
  })
}

describe('OnboardingBanner', () => {
  it('renders step 1 initially', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Welcome to AI Vocab Coach!')
    expect(wrapper.text()).toContain('Choose your source and target languages below.')
  })

  it('clicking Next advances to step 2', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    const dots = wrapper.findAll('.rounded-full')
    expect(dots[0].classes()).toContain('bg-indigo-200')
    expect(dots[1].classes()).toContain('bg-indigo-500')
  })

  it('clicking Skip hides the banner', async () => {
    const wrapper = mountComponent()
    await wrapper.find('button.text-indigo-500').trigger('click')
    expect(wrapper.find('[class*="rounded-xl"]').exists()).toBe(false)
  })

  it('does not render when onboarding is done', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('true')
    const wrapper = mountComponent()
    expect(wrapper.find('[class*="rounded-xl"]').exists()).toBe(false)
  })
})
