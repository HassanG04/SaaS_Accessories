import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthAlert } from '../features/auth/AuthAlert'
import { mapAuthError } from '../features/auth/authErrors'
import { useAuth } from '../features/auth/AuthProvider'
import { Turnstile } from '../features/auth/Turnstile'
import { useCaptcha } from '../features/auth/useCaptcha'
import type { AuthErrorCode } from '../features/auth/types'
import { useLanguage } from '@/i18n/LanguageProvider'
import { Button } from '@/components/ui/Button'

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const captcha = useCaptcha()
  const [formStatusMessage, setFormStatusMessage] = useState<AuthErrorCode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Detect expired or invalid reset link from URL params or hash
  const urlStatusMessage = useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    const rawHash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
    const hashParams = new URLSearchParams(rawHash)

    const errorParam = searchParams.get('error') || hashParams.get('error')
    const errorCodeParam = searchParams.get('error_code') || hashParams.get('error_code')
    const errorDescParam =
      searchParams.get('error_description') || hashParams.get('error_description')

    if (errorParam || errorCodeParam || errorDescParam) {
      const combined = `${errorCodeParam || ''} ${errorDescParam || ''} ${errorParam || ''}`
      return mapAuthError(combined)
    }
    return null
  }, [location.search, location.hash])

  const statusMessage = formStatusMessage || urlStatusMessage

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormStatusMessage(null)

    if (!email.trim()) {
      setFormStatusMessage('AUTH-001')
      return
    }

    if (!captcha.token) {
      setFormStatusMessage('AUTH-003')
      captcha.renew()
      return
    }

    setIsSubmitting(true)
    try {
      const result = await resetPassword({
        email: email.trim(),
        captchaToken: captcha.token,
      })

      // Always display neutral outcome AUTH-010
      setFormStatusMessage(result.code || 'AUTH-010')
    } finally {
      captcha.renew()
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="auth-panel rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-h2 font-bold font-accent text-(--color-brand)">
            {t.auth.resetPassword}
          </h1>
          <p className="text-small text-(--color-text-muted)">{t.auth.resetPasswordSubtitle}</p>
        </div>

        {statusMessage === 'AUTH-010' ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-(--radius-card) border border-(--color-border) bg-(--color-surface-tint) p-6 text-center space-y-4"
          >
            <div className="mx-auto flex size-12 items-center justify-center rounded-(--radius-pill) bg-(--color-brand)/10 text-(--color-brand)">
              <svg
                className="size-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-h3 font-bold font-accent text-(--color-brand)">
                {t.auth.checkYourEmail}
              </h2>
              <p className="text-small text-(--color-text)">{t.auth.checkResetEmailDesc}</p>
              <p className="text-caption text-(--color-text-muted)">{t.auth.checkSpamFolder}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                captcha.renew()
                setFormStatusMessage(null)
              }}
            >
              {t.auth.resendNoticeLink}
            </Button>
          </div>
        ) : (
          <>
            {statusMessage && <AuthAlert code={statusMessage} />}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1">
                <label
                  htmlFor="email-input"
                  className="text-small font-semibold text-(--color-text)"
                >
                  {t.auth.email}
                </label>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full h-11 rounded-(--radius-pill) border border-(--color-border-input) bg-(--color-bg) px-4 text-small text-(--color-text) focus:border-(--color-brand) focus:outline-none focus:ring-2 focus:ring-(--color-focus)"
                />
              </div>

              <Turnstile key={captcha.revision} {...captcha.widgetProps} />

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full text-small disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-(--color-focus)"
              >
                {isSubmitting ? t.auth.sendingResetLink : t.auth.sendResetLink}
              </Button>
            </form>
            <p className="text-center text-caption text-(--color-text-muted)">
              <Link
                to="/resend-confirmation"
                className="font-semibold text-(--color-brand) hover:underline"
              >
                {t.auth.resend}
              </Link>
            </p>
          </>
        )}

        <div className="text-center text-small text-(--color-text-muted)">
          {t.auth.rememberPassword}{' '}
          <Link to="/login" className="font-semibold text-(--color-brand) hover:underline">
            {t.auth.login}
          </Link>
        </div>
      </div>
    </div>
  )
}
