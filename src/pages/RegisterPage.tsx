import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthAlert } from '../features/auth/AuthAlert'
import { useAuth } from '../features/auth/AuthProvider'
import { Turnstile } from '../features/auth/Turnstile'
import { useCaptcha } from '../features/auth/useCaptcha'
import { validatePasswordStrength } from '../features/auth/passwordStrength'
import type { AuthErrorCode } from '../features/auth/types'
import { useLanguage } from '@/i18n/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/PasswordField'

export default function RegisterPage() {
  const { signUp, resendConfirmation } = useAuth()
  const { t } = useLanguage()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const captcha = useCaptcha()
  const [statusMessage, setStatusMessage] = useState<AuthErrorCode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  async function handleResend() {
    if (isResending || !email.trim() || !captcha.token) return
    setIsResending(true)
    setResendSent(false)
    try {
      const result = await resendConfirmation({ email: email.trim(), captchaToken: captcha.token })
      if (result.success) {
        setResendSent(true)
      }
    } finally {
      captcha.renew()
      setIsResending(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatusMessage(null)

    if (!email.trim() || !password || !confirmPassword) {
      setStatusMessage('AUTH-001')
      return
    }

    if (!validatePasswordStrength(password).valid) {
      setStatusMessage('AUTH-008')
      return
    }

    if (password !== confirmPassword) {
      setStatusMessage('AUTH-013')
      return
    }

    if (!captcha.token) {
      setStatusMessage('AUTH-003')
      captcha.renew()
      return
    }

    setIsSubmitting(true)
    try {
      const result = await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        captchaToken: captcha.token,
      })

      if (!result.success) {
        setStatusMessage(result.code || 'AUTH-001')
      } else {
        setStatusMessage(result.code || 'AUTH-010')
      }
    } finally {
      captcha.renew()
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="auth-panel rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-h2 font-bold font-accent text-(--color-brand)">{t.auth.register}</h1>
          <p className="text-small text-(--color-text-muted)">{t.auth.registerSubtitle}</p>
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
            <div className="pt-2 space-y-2">
              {!resendSent && <Turnstile key={captcha.revision} {...captcha.widgetProps} />}
              {resendSent ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-small font-semibold text-(--color-brand)"
                >
                  {t.auth.checkEmailDesc}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || !captcha.token}
                  className="inline-flex h-10 items-center justify-center rounded-(--radius-pill) border border-(--color-border-input) bg-(--color-surface) px-4 text-small font-semibold text-(--color-brand) hover:bg-(--color-surface-2) focus:outline-none focus:ring-2 focus:ring-(--color-focus) disabled:opacity-50"
                >
                  {isResending ? t.auth.sendingConfirmationLink : t.auth.resendNoticeLink}
                </button>
              )}
            </div>
            <div className="pt-2 flex flex-wrap justify-center items-center gap-3 text-caption">
              <Link to="/login" className="font-semibold text-(--color-brand) hover:underline">
                {t.auth.login} &larr;
              </Link>
              <span className="text-(--color-text-muted)">•</span>
              <Link
                to="/reset-password"
                className="font-semibold text-(--color-brand) hover:underline"
              >
                {t.auth.requestNewResetLink} &larr;
              </Link>
            </div>
          </div>
        ) : (
          <>
            {statusMessage && <AuthAlert code={statusMessage} />}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1">
                <label
                  htmlFor="name-input"
                  className="text-small font-semibold text-(--color-text)"
                >
                  {t.auth.fullName}
                </label>
                <input
                  id="name-input"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.auth.fullNamePlaceholder}
                  className="w-full h-11 rounded-(--radius-pill) border border-(--color-border-input) bg-(--color-bg) px-4 text-small text-(--color-text) focus:border-(--color-brand) focus:outline-none focus:ring-2 focus:ring-(--color-focus)"
                />
              </div>

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

              <div className="space-y-1">
                <PasswordField
                  id="password-input"
                  label={t.auth.password}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  allowGenerate={true}
                  onGenerate={(p) => {
                    setPassword(p)
                    setConfirmPassword(p)
                  }}
                  hint={t.auth.passwordMinLength}
                />
              </div>

              <div className="space-y-1">
                <PasswordField
                  id="confirm-password-input"
                  label={t.auth.confirmPassword}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Turnstile key={captcha.revision} {...captcha.widgetProps} />

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full text-small disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-(--color-focus)"
              >
                {isSubmitting ? t.auth.creatingAccount : t.auth.registerButton}
              </Button>
            </form>
          </>
        )}

        <div className="text-center text-small text-(--color-text-muted)">
          {t.auth.haveAccount}{' '}
          <Link to="/login" className="font-semibold text-(--color-brand) hover:underline">
            {t.auth.login}
          </Link>
        </div>
      </div>
    </div>
  )
}
