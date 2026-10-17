import { useEffect, useRef } from 'react'
import { getEnv } from '../../lib/env'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export interface TurnstileProps {
  onVerify: (token: string) => void
  onError?: () => void
  onExpire?: () => void
  className?: string
}

export function Turnstile({ onVerify, onError, onExpire, className = '' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const callbacks = useRef({ onVerify, onError, onExpire })

  useEffect(() => {
    callbacks.current = { onVerify, onError, onExpire }
  }, [onVerify, onError, onExpire])

  useEffect(() => {
    let siteKey: string
    try {
      siteKey = getEnv().VITE_TURNSTILE_SITE_KEY
    } catch {
      callbacks.current.onError?.()
      return
    }

    // Cloudflare's documented dummy keys must never protect a production form.
    if (import.meta.env.PROD && /^[123]x0+[A-Z]{2}$/.test(siteKey)) {
      callbacks.current.onError?.()
      return
    }

    let disposed = false
    let checkInterval: ReturnType<typeof setInterval> | null = null

    const renderWidget = () => {
      if (!disposed && containerRef.current && window.turnstile && !widgetIdRef.current) {
        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => {
              if (!disposed) callbacks.current.onVerify(token)
            },
            'error-callback': () => {
              if (!disposed) callbacks.current.onError?.()
            },
            'expired-callback': () => {
              if (!disposed) callbacks.current.onExpire?.()
            },
            theme: 'auto',
          })
          widgetIdRef.current = id
        } catch {
          callbacks.current.onError?.()
        }
      }
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      let attempts = 0
      checkInterval = setInterval(() => {
        attempts++
        if (window.turnstile) {
          if (checkInterval) clearInterval(checkInterval)
          renderWidget()
        } else if (attempts > 50) {
          // Timeout after 5s
          if (checkInterval) clearInterval(checkInterval)
          callbacks.current.onError?.()
        }
      }, 100)
    }

    return () => {
      disposed = true
      if (checkInterval) clearInterval(checkInterval)
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // ignore cleanup errors
        }
      }
      widgetIdRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`my-2 flex justify-center min-h-[65px] ${className}`}
      data-testid="turnstile-widget"
    />
  )
}
