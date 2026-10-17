import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import LoginPage from '@/pages/LoginPage'
import { getEnv } from '@/lib/env'
import { Turnstile } from './Turnstile'

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }))
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ signIn }) }))
vi.mock('@/lib/env', () => ({ getEnv: vi.fn() }))

type Widget = NonNullable<Window['turnstile']>
type Options = Parameters<Widget['render']>[1]
let challenges: Options[]
const renderWidget = vi.fn<Widget['render']>()
const remove = vi.fn<Widget['remove']>()

beforeEach(() => {
  challenges = []
  vi.stubEnv('PROD', false)
  vi.mocked(getEnv).mockReturnValue({
    VITE_SUPABASE_URL: 'https://example.invalid',
    VITE_SUPABASE_ANON_KEY: 'test-public-key',
    VITE_TURNSTILE_SITE_KEY: 'test-site-key',
  })
  renderWidget.mockImplementation((_container, options) => {
    challenges.push(options)
    return `widget-${challenges.length}`
  })
  window.turnstile = { render: renderWidget, remove, reset: vi.fn() }
  signIn.mockResolvedValue({ success: false, code: 'AUTH-001' })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

test('changing form callbacks does not remove the widget; it uses the latest callbacks', () => {
  const oldVerify = vi.fn()
  const newVerify = vi.fn()
  const onExpire = vi.fn()
  const onError = vi.fn()
  const { rerender } = render(<Turnstile onVerify={oldVerify} />)
  rerender(<Turnstile onVerify={newVerify} onExpire={onExpire} onError={onError} />)
  expect(renderWidget).toHaveBeenCalledTimes(1)
  expect(remove).not.toHaveBeenCalled()
  challenges[0]?.callback('fresh-token')
  challenges[0]?.['expired-callback']?.()
  challenges[0]?.['error-callback']?.()
  expect(oldVerify).not.toHaveBeenCalled()
  expect(newVerify).toHaveBeenCalledWith('fresh-token')
  expect(onExpire).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledOnce()
})

test('Strict Mode recreates the widget and ignores callbacks from disposed challenges', () => {
  const onVerify = vi.fn()
  const { unmount } = render(
    <StrictMode>
      <Turnstile onVerify={onVerify} />
    </StrictMode>,
  )
  expect(renderWidget).toHaveBeenCalledTimes(2)
  challenges[0]?.callback('disposed-token')
  expect(onVerify).not.toHaveBeenCalled()
  challenges[1]?.callback('current-token')
  expect(onVerify).toHaveBeenCalledWith('current-token')
  unmount()
  challenges[1]?.callback('late-token')
  expect(onVerify).toHaveBeenCalledTimes(1)
  expect(remove).toHaveBeenCalledTimes(2)
})

test('waits for the script; timeout reports failure without inventing a token', () => {
  vi.useFakeTimers()
  delete window.turnstile
  const onError = vi.fn()
  const onVerify = vi.fn()
  const { unmount } = render(<Turnstile onVerify={onVerify} onError={onError} />)
  act(() => vi.advanceTimersByTime(5200))
  expect(onError).toHaveBeenCalledOnce()
  expect(onVerify).not.toHaveBeenCalled()
  unmount()
  render(<Turnstile onVerify={onVerify} onError={onError} />)
  window.turnstile = { render: renderWidget, remove, reset: vi.fn() }
  act(() => vi.advanceTimersByTime(200))
  expect(renderWidget).toHaveBeenCalledOnce()
})

test('missing configuration fails closed instead of using a dummy key', () => {
  vi.mocked(getEnv).mockImplementation(() => {
    throw new Error('test configuration failure')
  })
  const onError = vi.fn()
  render(<Turnstile onVerify={vi.fn()} onError={onError} />)
  expect(renderWidget).not.toHaveBeenCalled()
  expect(onError).toHaveBeenCalledOnce()
})

test('production rejects Cloudflare dummy site keys', () => {
  vi.stubEnv('PROD', true)
  vi.mocked(getEnv).mockReturnValue({
    VITE_SUPABASE_URL: 'https://example.invalid',
    VITE_SUPABASE_ANON_KEY: 'test-public-key',
    VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  })
  const onError = vi.fn()
  render(<Turnstile onVerify={vi.fn()} onError={onError} />)
  expect(renderWidget).not.toHaveBeenCalled()
  expect(onError).toHaveBeenCalledOnce()
})

test.each(['expired-callback', 'error-callback'] as const)(
  'login discards a token on %s and renews it after each submitted attempt',
  async (invalidate) => {
    render(
      <LanguageProvider initialLanguage="en">
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </LanguageProvider>,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'owner@example.invalid' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'existing-password' } })
    const submit = screen.getByRole('button', { name: 'Log in' })
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(signIn).not.toHaveBeenCalled()
    act(() => challenges.at(-1)?.callback('expired-token'))
    act(() => challenges.at(-1)?.[invalidate]?.())
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(signIn).not.toHaveBeenCalled()
    act(() => challenges.at(-1)?.callback('fresh-token'))
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(signIn).toHaveBeenCalledWith(expect.objectContaining({ captchaToken: 'fresh-token' }))
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(signIn).toHaveBeenCalledTimes(1)
    act(() => challenges.at(-1)?.callback('second-token'))
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(signIn).toHaveBeenCalledTimes(2)
    expect(signIn).toHaveBeenLastCalledWith(
      expect.objectContaining({ captchaToken: 'second-token' }),
    )
  },
)
