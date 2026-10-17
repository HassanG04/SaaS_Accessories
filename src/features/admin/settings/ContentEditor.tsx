import { useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/i18n/LanguageProvider'
import { contentLabels, editorCopy } from '@/i18n/contentEditor'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ErrorPanel } from '@/components/ui/ErrorPanel'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ProductImage, useCategories, useProduct, useSearchProducts } from '@/features/catalog'
import { AppError } from '@/lib/errors'
import {
  CONTENT_FIELDS,
  POLICY_ROUTES,
  type ContentField,
  type StorefrontContent,
} from '@/features/settings/content'
import {
  getContentSnapshot,
  saveContentSnapshot,
  uploadHeroImage,
  type ContentSnapshot,
} from './content.api'

export const CONTENT_QUERY_KEY = ['settings', 'content-editor'] as const
type Section = 'hero' | 'about' | 'footer' | 'policies'
const fields: Record<Section, readonly ContentField[]> = {
  hero: ['hero_title', 'hero_subtitle', 'hero_caption', 'hero_badge', 'announcement'],
  about: [
    'about_title',
    'about_body',
    'delivery_title',
    'delivery_body',
    'returns_title',
    'returns_summary',
  ],
  footer: ['brand_name', 'tagline', 'copyright'],
  policies: POLICY_ROUTES.flatMap((route) => [`${route}_label`, `${route}_body`] as const),
}
function move<T>(items: readonly T[], index: number, offset: number): T[] {
  const next = [...items],
    item = next[index],
    other = next[index + offset]
  if (item !== undefined && other !== undefined) {
    next[index] = other
    next[index + offset] = item
  }
  return next
}

export default function ContentEditor() {
  const { lang } = useLanguage(),
    c = editorCopy[lang],
    column = lang === 'ar' ? 0 : 1
  const client = useQueryClient(),
    photoInput = useRef<HTMLInputElement>(null)
  const query = useQuery({ queryKey: CONTENT_QUERY_KEY, queryFn: getContentSnapshot })
  const [draft, setDraft] = useState<ContentSnapshot | null>(null)
  const [section, setSection] = useState<Section>('hero')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false)
  const [conflict, setConflict] = useState(false),
    [error, setError] = useState<unknown>(null)
  const snapshot = draft ?? query.data,
    content = snapshot?.content ?? {}
  const { data: categories = [] } = useCategories()
  const { data: matches = [] } = useSearchProducts(search)
  const { data: selectedProduct } = useProduct(content.featured_product_id)
  const products = [
    ...new Map(
      [...(selectedProduct ? [selectedProduct] : []), ...matches].map((p) => [p.id, p]),
    ).values(),
  ]
  const selectedCategories = content.category_ids ?? categories.map((category) => category.id)
  const footerOrder = content.footer_order ?? [...POLICY_ROUTES]
  function update<K extends keyof StorefrontContent>(key: K, value: StorefrontContent[K]) {
    if (!snapshot) return
    setDraft({ ...snapshot, content: { ...content, [key]: value } })
    setSaved(false)
  }
  async function publish(event: FormEvent) {
    event.preventDefault()
    if (!snapshot) return
    setBusy(true)
    setError(null)
    setConflict(false)
    try {
      if (
        CONTENT_FIELDS.some(
          (field) =>
            Boolean(content[`${field}_ar`]?.trim()) !== Boolean(content[`${field}_en`]?.trim()),
        )
      )
        throw new AppError('ADM-007')
      const revision = await saveContentSnapshot(snapshot)
      if (!revision) {
        setConflict(true)
        return
      }
      client.setQueryData(CONTENT_QUERY_KEY, { content, revision })
      setDraft(null)
      setSaved(true)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['settings', 'public'] }),
        client.invalidateQueries({ queryKey: ['audit_log', 'shop_settings'] }),
      ])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  async function upload(file?: File) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      update('hero_image_path', await uploadHeroImage(file))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  if (query.error)
    return (
      <ErrorPanel
        error={query.error}
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  if (!snapshot)
    return (
      <div role="status" aria-label={c.loading}>
        <SkeletonCard />
      </div>
    )

  return (
    <form
      onSubmit={(event) => {
        void publish(event)
      }}
      className="space-y-5 min-w-0"
    >
      <p className="text-small text-text-muted">{c.hint}</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(fields) as Section[]).map((key) => (
          <Button
            key={key}
            type="button"
            variant={section === key ? 'primary' : 'secondary'}
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {c[key]}
          </Button>
        ))}
      </div>
      {error != null && <ErrorPanel error={error} />}
      {conflict && (
        <p role="alert" className="text-danger">
          {c.conflict}
        </p>
      )}
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <legend className="sr-only">{c[section]}</legend>
        {section === 'hero' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                aria-label={c.photo}
                className="block w-full max-w-sm rounded-card border border-border p-2 focus-visible:ring-2 focus-visible:ring-focus"
              >
                <ProductImage
                  src={content.hero_image_path || 'categories/earrings-cover.webp'}
                  alt={c.photo}
                  aspectRatio="4/3"
                />
              </button>
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label={c.photo}
                className="sr-only"
                onChange={(event) => {
                  void upload(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <Button type="button" variant="ghost" onClick={() => update('hero_image_path', '')}>
                {c.clearPhoto}
              </Button>
            </div>
            <div className="space-y-3">
              <Input
                label={c.search}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <label className="block space-y-2">
                <span>{c.featured}</span>
                <select
                  className="ui-field w-full rounded-pill border border-border bg-surface p-3"
                  value={content.featured_product_id ?? ''}
                  onChange={(event) =>
                    update(
                      'featured_product_id',
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                >
                  <option value="">{c.automatic}</option>
                  {content.featured_product_id && !selectedProduct && (
                    <option value={content.featured_product_id}>
                      #{content.featured_product_id}
                    </option>
                  )}
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {lang === 'ar' ? product.name_ar || product.name : product.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
        <div className="space-y-5">
          {fields[section].map((field) => (
            <div key={field} className="grid gap-3 sm:grid-cols-2">
              {(['ar', 'en'] as const).map((locale) => {
                const key = `${field}_${locale}` as const,
                  label = `${contentLabels[field][column]} (${locale === 'ar' ? 'العربية' : 'English'})`
                return (
                  <label key={key} className="block min-w-0 space-y-2">
                    <span>{label}</span>
                    <textarea
                      dir={locale === 'ar' ? 'rtl' : 'ltr'}
                      lang={locale}
                      rows={field.endsWith('_body') ? 6 : 2}
                      maxLength={field.endsWith('_body') ? 12000 : 500}
                      className="ui-field block w-full rounded-card border border-border-input bg-surface p-3"
                      value={content[key] ?? ''}
                      onChange={(event) => update(key, event.target.value)}
                    />
                  </label>
                )
              })}
            </div>
          ))}
        </div>
        {section === 'hero' && (
          <fieldset className="space-y-3">
            <legend>{c.categories}</legend>
            <div className="flex flex-wrap gap-3">
              {categories.map((category) => (
                <label key={category.id} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id)}
                    onChange={(event) =>
                      update(
                        'category_ids',
                        event.target.checked
                          ? [...selectedCategories, category.id]
                          : selectedCategories.filter((id) => id !== category.id),
                      )
                    }
                  />
                  {lang === 'ar' ? category.name_ar || category.name : category.name}
                </label>
              ))}
            </div>
            {selectedCategories.map((id, index) => (
              <div key={id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  {categories.find((category) => category.id === id)?.[
                    lang === 'ar' ? 'name_ar' : 'name'
                  ] ?? `#${id}`}
                </span>
                <Button
                  type="button"
                  disabled={index === 0}
                  aria-label={`${c.up} ${index + 1}`}
                  onClick={() => update('category_ids', move(selectedCategories, index, -1))}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  disabled={index === selectedCategories.length - 1}
                  aria-label={`${c.down} ${index + 1}`}
                  onClick={() => update('category_ids', move(selectedCategories, index, 1))}
                >
                  ↓
                </Button>
              </div>
            ))}
          </fieldset>
        )}
        {section === 'footer' && (
          <div className="space-y-4">
            {(['phone', 'whatsapp_url', 'instagram_url', 'tiktok_url'] as const).map((key) => (
              <Input
                key={key}
                label={c[key]}
                dir="ltr"
                value={content[key] ?? ''}
                onChange={(event) => update(key, event.target.value)}
              />
            ))}
            <h3>{c.order}</h3>
            {footerOrder.map((route, index) => (
              <div key={route} className="flex items-center gap-2">
                <span className="flex-1">{contentLabels[`${route}_label`][column]}</span>
                <Button
                  type="button"
                  disabled={index === 0}
                  aria-label={`${c.up} ${route}`}
                  onClick={() => update('footer_order', move(footerOrder, index, -1))}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  disabled={index === footerOrder.length - 1}
                  aria-label={`${c.down} ${route}`}
                  onClick={() => update('footer_order', move(footerOrder, index, 1))}
                >
                  ↓
                </Button>
              </div>
            ))}
          </div>
        )}
        <details className="rounded-card border border-border p-4">
          <summary>{c.preview}</summary>
          <div className="space-y-3 pt-3">
            {fields[section].map((field) => (
              <p key={field} className="whitespace-pre-wrap break-words">
                {content[`${field}_${lang}`]}
              </p>
            ))}
          </div>
        </details>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !draft}>
          {busy ? c.saving : c.save}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setDraft(null)
            setConflict(false)
            setError(null)
            setSaved(false)
            void query.refetch()
          }}
        >
          {c.reload}
        </Button>
        <span role="status">{saved ? c.saved : draft ? c.unsaved : ''}</span>
      </div>
    </form>
  )
}
