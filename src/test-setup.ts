import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

configure({ asyncUtilTimeout: 4000 })

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(window.navigator, 'language', {
  value: 'ar',
  configurable: true,
})

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: () => {},
})

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

// Only test fixtures issue synthetic CAPTCHA tokens. Production uses the real widget.
beforeEach(() => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  window.turnstile = {
    render: (_container, options) => {
      const id = crypto.randomUUID()
      timers.set(
        id,
        setTimeout(() => options.callback('test-turnstile-token'), 0),
      )
      return id
    },
    reset: () => {},
    remove: (id) => {
      clearTimeout(timers.get(id))
      timers.delete(id)
    },
  }
})

afterEach(cleanup)
