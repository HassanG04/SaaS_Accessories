export const CONTENT_FIELDS = [
  'hero_title',
  'hero_subtitle',
  'hero_caption',
  'hero_badge',
  'brand_name',
  'tagline',
  'copyright',
  'announcement',
  'about_title',
  'about_body',
  'delivery_title',
  'delivery_body',
  'returns_title',
  'returns_summary',
  'returns_body',
  'terms_label',
  'terms_body',
  'privacy_label',
  'privacy_body',
  'returns_label',
  'shipping_label',
  'shipping_body',
  'contact_label',
  'contact_body',
] as const
export const POLICY_ROUTES = ['terms', 'privacy', 'returns', 'shipping', 'contact'] as const
export type PolicyRoute = (typeof POLICY_ROUTES)[number]
export type ContentField = (typeof CONTENT_FIELDS)[number]
export type LocalizedContentKey = `${ContentField}_${'ar' | 'en'}`
export type StorefrontContent = Partial<Record<LocalizedContentKey, string>> & {
  hero_image_path?: string
  featured_product_id?: number | null
  category_ids?: number[]
  footer_order?: PolicyRoute[]
  phone?: string
  whatsapp_url?: string
  instagram_url?: string
  tiktok_url?: string
}

/** Public JSON is checked before rendering, including older/incomplete rows. */
export function readStorefrontContent(value: unknown): StorefrontContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const content: StorefrontContent = {}
  for (const field of CONTENT_FIELDS) {
    for (const lang of ['ar', 'en'] as const) {
      const key = `${field}_${lang}` as const
      if (typeof raw[key] === 'string') content[key] = raw[key]
    }
  }
  for (const key of [
    'hero_image_path',
    'phone',
    'whatsapp_url',
    'instagram_url',
    'tiktok_url',
  ] as const) {
    if (typeof raw[key] === 'string') content[key] = raw[key]
  }
  if (
    raw.featured_product_id === null ||
    (typeof raw.featured_product_id === 'number' &&
      Number.isSafeInteger(raw.featured_product_id) &&
      raw.featured_product_id > 0)
  ) {
    content.featured_product_id = raw.featured_product_id
  }
  if (Array.isArray(raw.category_ids))
    content.category_ids = raw.category_ids.filter(
      (id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
    )
  if (Array.isArray(raw.footer_order))
    content.footer_order = raw.footer_order.filter((route): route is PolicyRoute =>
      POLICY_ROUTES.some((allowed) => route === allowed),
    )
  return content
}
