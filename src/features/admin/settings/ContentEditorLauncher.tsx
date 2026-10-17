import { lazy, Suspense, useContext, useState } from 'react'
import { AuthContext } from '@/features/auth/AuthProvider'
import { useLanguage } from '@/i18n/LanguageProvider'
import { editorCopy } from '@/i18n/contentEditor'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
const ContentEditor = lazy(() => import('./ContentEditor'))

export default function ContentEditorLauncher() {
  const auth = useContext(AuthContext),
    { lang } = useLanguage()
  const [open, setOpen] = useState(false)
  if (auth?.profile?.role !== 'admin') return null
  return (
    <section className="space-y-4 rounded-card border border-border bg-surface p-4">
      <Button type="button" variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m5 3 14 9-6 1-3 7-5-17Z" />
        </svg>
        {editorCopy[lang].title}
      </Button>
      {open && (
        <Suspense fallback={<SkeletonCard />}>
          <ContentEditor />
        </Suspense>
      )}
    </section>
  )
}
