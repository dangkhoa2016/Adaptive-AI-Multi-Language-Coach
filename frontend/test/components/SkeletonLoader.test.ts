import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SkeletonLoader from '../../src/components/SkeletonLoader.vue'

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(SkeletonLoader, { props })
}

describe('SkeletonLoader', () => {
  it('renders text variant by default with 1 line', () => {
    const wrapper = mountComponent()
    const lines = wrapper.findAll('.animate-pulse')
    expect(lines).toHaveLength(1)
  })

  it('renders multiple lines with text variant', () => {
    const wrapper = mountComponent({ variant: 'text', lines: 3 })
    expect(wrapper.findAll('.animate-pulse')).toHaveLength(3)
  })

  it('renders card variant', () => {
    const wrapper = mountComponent({ variant: 'card' })
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    expect(wrapper.classes()).toContain('rounded-xl')
  })

  it('renders circle variant', () => {
    const wrapper = mountComponent({ variant: 'circle' })
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    expect(wrapper.classes()).toContain('rounded-full')
  })

  it('applies custom width and height to card variant', () => {
    const wrapper = mountComponent({ variant: 'card', width: '200px', height: '100px' })
    const inner = wrapper.find('.rounded.bg-slate-200')
    expect(inner.attributes('style')).toContain('width: 200px')
    expect(inner.attributes('style')).toContain('height: 100px')
  })

  it('applies custom width and height to circle variant', () => {
    const wrapper = mountComponent({ variant: 'circle', width: '4rem', height: '4rem' })
    expect(wrapper.attributes('style')).toContain('width: 4rem')
    expect(wrapper.attributes('style')).toContain('height: 4rem')
  })

  it('applies custom height to text variant', () => {
    const wrapper = mountComponent({ variant: 'text', height: '2rem' })
    const pulse = wrapper.find('.animate-pulse')
    expect(pulse.attributes('style')).toContain('height: 2rem')
  })

  it('last line is 60% width in text variant', () => {
    const wrapper = mountComponent({ variant: 'text', lines: 2 })
    const lines = wrapper.findAll('.animate-pulse')
    expect(lines[1].attributes('style')).toContain('width: 60%')
  })
})
