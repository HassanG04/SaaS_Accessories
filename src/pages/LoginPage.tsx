import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthAlert } from '../features/auth/AuthAlert'
import { mapAuthError } from '../features/auth/authErrors'
import { useAuth } from '../features/auth/AuthProvider'
import { Turnstile } from '../features/auth/Turnstile'
import { useCaptcha } from '../features/auth/useCaptcha'
import type { AuthErrorCode } from '../features/auth/types'
import { useLanguage } from '@/i18n/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/PasswordField'

export default function LoginPage() {
  const { signIn } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const captcha = useCaptcha()
  const [formErrorCode, setFormErrorCode] = useState<AuthErrorCode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const params = new URLSearchParams(location.search)
  const redirectTo = params.get('redirect') || '/'

  // Detect expired or invalid link errors returned via URL query or hash from Supabase
  const urlErrorCode = useMemo(() => {
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

  const errorCode = formErrorCode || urlErrorCode

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormErrorCode(null)

    if (!email.trim() || !password) {
      setFormErrorCode('AUTH-001')
      return
    }

    if (password.length < 10) {
      setFormErrorCode('AUTH-008')
      return
    }

    if (!captcha.token) {
      setFormErrorCode('AUTH-003')
      captcha.renew()
      return
    }

    setIsSubmitting(true)
    try {
      const result = await signIn({
        email: email.trim(),
        password,
        captchaToken: captcha.token,
      })

      if (!result.success) {
        setFormErrorCode(result.code || 'AUTH-001')
      } else {
        navigate(redirectTo, { replace: true })
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
          <h1 className="text-h2 font-bold font-accent text-(--color-brand)">{t.auth.login}</h1>
          <p className="text-small text-(--color-text-muted)">{t.auth.loginSubtitle}</p>
        </div>

        {errorCode && (
          <div className="space-y-3">
            <AuthAlert code={errorCode} />
            {errorCode === 'AUTH-009' && (
              <div className="rounded-(--radius-card) border border-(--color-border) bg-(--color-surface-tint) p-3 text-small text-(--color-text) space-y-2">
                <p className="font-semibold text-(--color-brand)">{t.auth.linkExpiredTitle}</p>
                <div className="flex flex-wrap gap-2 text-caption">
                  <Link
                    to="/resend-confirmation"
                    className="font-semibold text-(--color-brand) hover:underline"
                  >
                    {t.auth.requestNewConfirmationLink} &larr;
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
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email-input" className="text-small font-semibold text-(--color-text)">
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
            <div className="flex items-center justify-between">
              <label
                htmlFor="password-input"
                className="text-small font-semibold text-(--color-text)"
              >
                {t.auth.password}
              </label>
              <Link
                to="/reset-password"
                className="text-caption font-semibold text-(--color-brand) hover:underline"
              >
                {t.auth.forgot}
              </Link>
            </div>
            <PasswordField
              id="password-input"
              label=""
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              hint={t.auth.passwordMinLength}
            />
          </div>

          <Turnstile key={captcha.revision} {...captcha.widgetProps} />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full text-small disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-(--color-focus)"
          >
            {isSubmitting ? t.auth.loggingIn : t.auth.login}
          </Button>
        </form>

        <div className="text-center text-small text-(--color-text-muted)">
          {t.auth.noAccount}{' '}
          <Link to="/register" className="font-semibold text-(--color-brand) hover:underline">
            {t.auth.register}
          </Link>
        </div>
      </div>
    </div>
  )
}
