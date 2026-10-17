import { useCallback, useState } from 'react'

/** Single-use token lifecycle. Supabase must still enforce CAPTCHA server-side. */
export function useCaptcha() {
  const [token, setToken] = useState<string>()
  const [revision, setRevision] = useState(0)
  const invalidate = useCallback(() => setToken(undefined), [])
  const renew = useCallback(() => {
    setToken(undefined)
    setRevision((value) => value + 1)
  }, [])

  return {
    token,
    revision,
    renew,
    widgetProps: { onVerify: setToken, onExpire: invalidate, onError: invalidate },
  }
}
