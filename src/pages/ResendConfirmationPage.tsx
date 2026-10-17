import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthAlert } from '../features/auth/AuthAlert'
import { useAuth } from '../features/auth/AuthProvider'
import { Turnstile } from '../features/auth/Turnstile'
import { useCaptcha } from '../features/auth/useCaptcha'
import type { AuthErrorCode } from '../features/auth/types'
import { useLanguage } from '@/i18n/LanguageProvider'
import { Button } from '@/components/ui/Button'

export default function ResendConfirmationPage() {
  const { resendConfirmation } = useAuth()
  const { t } = useLanguage()

  const [email, setEmail] = useState('')
  const captcha = useCaptcha()
  const [statusMessage, setStatusMessage] = useState<AuthErrorCode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatusMessage(null)

    if (!email.trim()) {
      setStatusMessage('AUTH-001')
      return
    }

    if (!captcha.token) {
      setStatusMessage('AUTH-003')
      captcha.renew()
      return
    }

    setIsSubmitting(true)
    try {
      const result = await resendConfirmation({
        email: email.trim(),
        captchaToken: captcha.token,
      })

      // Always display neutral outcome AUTH-010
      setStatusMessage(result.code || 'AUTH-010')
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
            {t.auth.resendConfirmation}
          </h1>
          <p className="text-small text-(--color-text-muted)">
            {t.auth.resendConfirmationSubtitle}
          </p>
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
              <p className="text-small text-(--color-text)">{t.auth.checkEmailDesc}</p>
              <p className="text-caption text-(--color-text-muted)">{t.auth.checkSpamFolder}</p>
            </div>
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
                {isSubmitting ? t.auth.sendingConfirmationLink : t.auth.sendConfirmationLink}
              </Button>
            </form>
          </>
        )}

        <div className="text-center text-small text-(--color-text-muted)">
          <Link to="/login" className="font-semibold text-(--color-brand) hover:underline">
            {t.auth.backToLogin}
          </Link>
        </div>
      </div>
    </div>
  )
}
