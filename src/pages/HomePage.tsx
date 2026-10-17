import { lazy, Suspense, useContext, useState, useMemo } from 'react'
import { AuthContext } from '@/features/auth/AuthProvider'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/i18n/LanguageProvider'
import {
  useCategories,
  useBestSellers,
  useBrowseProducts,
  ProductCard,
  ProductImage,
  CategoryTile,
  type ProductSortOption,
} from '@/features/catalog'
import { usePublicSettings } from '@/features/settings'
import { Sparkle, RibbonBow, RibbonDivider, PearlOrnament } from '@/components/ui/ornaments'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorPanel } from '@/components/ui/ErrorPanel'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionReveal } from '@/components/ui/SectionReveal'
import { isMotionReduced } from '@/lib/motion'

const ContentEditorLauncher = lazy(() => import('@/features/admin/settings/ContentEditorLauncher'))

export default function HomePage() {
  const auth = useContext(AuthContext)
  const { t, lang } = useLanguage()
  const { data: settings } = usePublicSettings()
  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    error: categoriesError,
  } = useCategories()
  const { data: bestSellers = [], isLoading: isBestSellersLoading } = useBestSellers(4)

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<ProductSortOption>('best_sellers')
  const [limit, setLimit] = useState<number>(12)

  const {
    data: browseData,
    isLoading: isBrowseLoading,
    error: browseError,
  } = useBrowseProducts({
    categorySlug: selectedCategory === 'all' ? undefined : selectedCategory,
    sortBy,
    limit,
    offset: 0,
  })

  // Dynamic public settings with truthful fallback logic
  const rawSalePercent = settings?.sale_percent
  const salePercent =
    typeof rawSalePercent === 'number' && Number.isFinite(rawSalePercent) && rawSalePercent > 0
      ? rawSalePercent
      : 0

  const heroTitle =
    (lang === 'ar' ? (settings?.hero_title_ar as string) : (settings?.hero_title_en as string)) ||
    (salePercent > 0 ? t('hero.title', { n: salePercent }) : t.hero.cozyTitle)

  const heroSubtitle =
    (lang === 'ar'
      ? (settings?.hero_subtitle_ar as string)
      : (settings?.hero_subtitle_en as string)) ||
    (salePercent > 0 ? t.hero.subtitle : t.hero.collectionsSubtitle)

  const returnsText =
    (lang === 'ar'
      ? (settings?.returns_text_ar as string)
      : (settings?.returns_text_en as string)) || t.catalog.returnsDetails

  const enabledPaymentMethods = useMemo(() => {
    const fromSettings = settings?.payment_methods_enabled
    if (Array.isArray(fromSettings) && fromSettings.length > 0) {
      return fromSettings.filter((m) => m === 'cod' || m === 'instapay_qr')
    }
    return ['cod', 'instapay_qr']
  }, [settings?.payment_methods_enabled])

  const handleCategorySelect = (slug: string, isKeyboard = false) => {
    setSelectedCategory(slug)
    setLimit(12)
    const el = document.getElementById('browse-heading') ?? document.getElementById('browse')
    if (el) {
      const prefersReduced = isMotionReduced()
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' })
      }
      if (isKeyboard) {
        el.setAttribute('tabindex', '-1')
        el.focus({ preventScroll: true })
      }
    }
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as ProductSortOption)
    setLimit(12)
  }

  const handleLoadMore = () => {
    setLimit((prev) => prev + 12)
  }

  const activeCategoryObject = useMemo(() => {
    if (selectedCategory === 'all') return null
    return categories.find((c) => c.slug === selectedCategory) ?? null
  }, [categories, selectedCategory])

  return (
    <div className="space-y-16 pb-16">
      {auth?.profile?.role === 'admin' && (
        <Suspense fallback={null}>
          <ContentEditorLauncher />
        </Suspense>
      )}
      {/* 1. HERO SECTION */}
      <section
        aria-label="Hero"
        className="relative overflow-hidden rounded-card border border-border bg-surface p-6 sm:p-10 lg:p-12 shadow-card"
      >
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
          {/* Hero text & CTA */}
          <div className="max-w-xl space-y-6 text-center lg:text-start">
            {/* Sale Banner tag or Eyebrow */}
            {salePercent > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-pill bg-surface-tint border border-border px-4 py-1.5 text-caption font-semibold text-brand shadow-pill">
                <Sparkle className="size-4 text-brand" />
                <span>{t('hero.title', { n: salePercent })}</span>
                <RibbonBow className="size-4 text-brand" />
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-pill bg-surface-tint border border-border px-4 py-1.5 text-caption font-semibold text-brand shadow-pill">
                <RibbonBow className="size-4 text-brand" />
                <span>{t.hero.eyebrow}</span>
              </div>
            )}

            <div className="space-y-3">
              <h1 className="font-accent text-display font-bold text-brand leading-tight">
                {heroTitle}
              </h1>
              <p className="text-body text-text-muted leading-relaxed">{heroSubtitle}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#browse"
                className="ui-control ui-button inline-flex items-center justify-center gap-2 rounded-pill font-semibold px-6 py-2.5 bg-brand text-brand-contrast transition-opacity hover:opacity-95 shadow-pill"
              >
                {salePercent > 0 ? t.hero.cta : t.hero.shopCta}
              </a>
              <a
                href="#store"
                className="ui-control ui-button inline-flex items-center justify-center gap-2 rounded-pill font-semibold px-6 py-2.5 border border-border-input bg-surface-2 text-text transition-colors hover:border-brand"
              >
                {t.catalog.exploreStore}
              </a>
            </div>

            {/* Pearl string ornament */}
            <div className="pt-2 flex justify-center lg:justify-start">
              <PearlOrnament className="h-6 w-32 text-sand" />
            </div>
          </div>

          {/* Rounded landscape frame & floating highlights */}
          <div className="relative flex flex-col sm:flex-row items-center gap-6">
            <figure className="relative">
              <div className="storefront-photo w-64 sm:w-72 aspect-[4/3] rounded-card border border-border bg-surface p-2 shadow-card sm:p-3">
                <ProductImage
                  src="categories/earrings-cover.webp"
                  alt="Lolys Jewelry Hero"
                  loading="eager"
                  fetchPriority="high"
                  aspectRatio="4/3"
                  className="size-full rounded-card"
                  imageClassName="size-full object-cover rounded-card"
                />
              </div>
              <figcaption className="storefront-caption flex items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2 text-caption sm:text-small font-semibold text-brand shadow-pill">
                <RibbonBow className="size-4 sm:size-5 shrink-0" />
                <span>{t.hero.photoCaption}</span>
              </figcaption>
            </figure>

            {/* Floating best seller card */}
            {isBestSellersLoading ? (
              <div className="hidden sm:block w-48 space-y-3 p-3 rounded-card border border-border bg-surface shadow-card">
                <Skeleton className="aspect-square w-full rounded-image" />
                <Skeleton className="h-4 w-3/4 rounded-chip" />
                <Skeleton className="h-4 w-1/2 rounded-chip" />
              </div>
            ) : bestSellers[0] ? (
              <div className="hidden sm:block w-52 transform transition-transform hover:-translate-y-1">
                <ProductCard product={bestSellers[0]} className="shadow-card" />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. CATEGORY PILLS (Quick Navigation) */}
      <nav aria-label="Categories quick links" className="space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-pressed={selectedCategory === 'all'}
            onClick={(e) => handleCategorySelect('all', e.detail === 0)}
            className={`rounded-pill px-5 py-2 text-small font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'bg-brand text-brand-contrast shadow-pill'
                : 'border border-border bg-surface text-text hover:border-brand hover:text-brand'
            }`}
          >
            {t.catalog.allCategories}
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.slug
            const displayName = lang === 'ar' ? cat.name_ar || cat.name : cat.name
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={isSelected}
                onClick={(e) => handleCategorySelect(cat.slug, e.detail === 0)}
                className={`rounded-pill px-5 py-2 text-small font-semibold transition-all ${
                  isSelected
                    ? 'bg-brand text-brand-contrast shadow-pill'
                    : 'border border-border bg-surface text-text hover:border-brand hover:text-brand'
                }`}
              >
                {displayName}
              </button>
            )
          })}
        </div>
      </nav>

      <RibbonDivider className="h-6 w-full text-pink" />

      {/* 3. STORE SECTION (Category Tiles with Arch Frames) */}
      <section id="store" aria-labelledby="store-heading" className="space-y-8 scroll-mt-24">
        <div className="text-center space-y-2 section-heading-reveal">
          <div className="inline-flex items-center gap-2 text-brand">
            <RibbonBow className="size-5" />
            <h2 id="store-heading" className="font-accent text-h2 font-bold text-brand">
              {t.section.categories}
            </h2>
            <RibbonBow className="size-5" />
          </div>
          <p className="text-body text-text-muted">
            {lang === 'ar'
              ? 'اكتشفي تشكيلاتنا المتنوعة من الإكسسوارات والقطع المنزلية المميزة'
              : 'Explore our curated collections of jewelry and home decor'}
          </p>
        </div>

        {categoriesError ? (
          <ErrorPanel error={categoriesError} />
        ) : isCategoriesLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="aspect-square w-full rounded-card" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState title={t.ui.emptyState} />
        ) : (
          <SectionReveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {categories.map((cat) => (
                <div key={cat.id} className="catalog-stagger-item">
                  <CategoryTile category={cat} />
                </div>
              ))}
            </div>
          </SectionReveal>
        )}
      </section>

      <RibbonDivider className="h-6 w-full text-pink" />

      {/* 4. BROWSE SECTION (Catalog Filters, Best Sellers first, Load More) */}
      <section id="browse" aria-labelledby="browse-heading" className="space-y-8 scroll-mt-24">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border pb-4">
          <div className="section-heading-reveal">
            <h2 id="browse-heading" className="font-accent text-h2 font-bold text-brand">
              {activeCategoryObject
                ? lang === 'ar'
                  ? activeCategoryObject.name_ar || activeCategoryObject.name
                  : activeCategoryObject.name
                : t.section.all}
            </h2>
            <p className="text-caption text-text-muted mt-1">
              {browseData
                ? `${browseData.totalCount} ${t('product.items_other', { count: browseData.totalCount })}`
                : ''}
            </p>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <label
              htmlFor="sort-select"
              className="text-small font-semibold text-text whitespace-nowrap"
            >
              {t.catalog.sortBy}:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={handleSortChange}
              className="rounded-pill border border-border-input bg-surface px-4 py-1.5 text-small text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <option value="best_sellers">{t.catalog.sortBestSellers}</option>
              <option value="newest">{t.catalog.sortNewest}</option>
              <option value="price_asc">{t.catalog.sortPriceAsc}</option>
              <option value="price_desc">{t.catalog.sortPriceDesc}</option>
            </select>
          </div>
        </div>

        {browseError ? (
          <ErrorPanel error={browseError} />
        ) : isBrowseLoading && !browseData ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : !browseData || browseData.products.length === 0 ? (
          <EmptyState title={t.catalog.noProducts} />
        ) : (
          <>
            <SectionReveal replayKey={selectedCategory}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {browseData.products.map((product) => (
                  <div key={product.id} className="catalog-stagger-item">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </SectionReveal>

            {/* Load more in steps of 12 */}
            {browseData.hasMore && (
              <div className="flex justify-center pt-8">
                <Button
                  variant="secondary"
                  onClick={handleLoadMore}
                  disabled={isBrowseLoading}
                  className="px-8 py-2.5"
                >
                  {t.catalog.loadMore}
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <RibbonDivider className="h-6 w-full text-pink" />

      {/* 5. ABOUT AND DELIVERY INFO SECTION */}
      <section id="about" aria-labelledby="about-heading" className="space-y-8 scroll-mt-24">
        <SectionReveal>
          <div className="space-y-8">
            <div className="text-center space-y-2 section-heading-reveal">
              <h2 id="about-heading" className="font-accent text-h2 font-bold text-brand">
                {t.section.about}
              </h2>
              <p className="text-body text-text-muted">
                {(lang === 'ar'
                  ? (settings?.tagline_ar as string)
                  : (settings?.tagline_en as string)) || t.brand.tagline}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* About story card */}
              <Card className="feature-card p-6 space-y-4 rounded-card border border-border bg-surface shadow-card">
                <div className="inline-flex size-12 items-center justify-center rounded-pill bg-surface-tint text-brand">
                  <RibbonBow className="size-6 text-brand" />
                </div>
                <h3 className="text-h3 font-bold text-brand">{t.section.about}</h3>
                <p className="text-body text-text-muted leading-relaxed">{t.catalog.aboutStory}</p>
              </Card>

              {/* Delivery & Payment card */}
              <Card className="feature-card p-6 space-y-4 rounded-card border border-border bg-surface shadow-card">
                <div className="inline-flex size-12 items-center justify-center rounded-pill bg-surface-tint text-brand">
                  <Sparkle className="size-6 text-brand" />
                </div>
                <h3 className="text-h3 font-bold text-brand">{t.section.delivery}</h3>
                <p className="text-body text-text-muted leading-relaxed">
                  {t.catalog.shippingDetails}
                </p>
                {enabledPaymentMethods.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {enabledPaymentMethods.includes('cod') && (
                      <span className="rounded-pill bg-surface-tint border border-border px-3 py-1 text-caption font-semibold text-brand">
                        {t.payment.cod}
                      </span>
                    )}
                    {enabledPaymentMethods.includes('instapay_qr') && (
                      <span className="rounded-pill bg-surface-tint border border-border px-3 py-1 text-caption font-semibold text-brand">
                        {t.payment.instapay}
                      </span>
                    )}
                  </div>
                )}
              </Card>

              {/* Returns & Exchange Guarantee card */}
              <Card className="feature-card p-6 space-y-4 rounded-card border border-border bg-surface shadow-card">
                <div className="inline-flex size-12 items-center justify-center rounded-pill bg-surface-tint text-brand">
                  <PearlOrnament className="h-6 w-12 text-brand" />
                </div>
                <h3 className="text-h3 font-bold text-brand">{t.catalog.returnsPolicy}</h3>
                <p className="text-body text-text-muted leading-relaxed">{returnsText}</p>
                <div className="pt-2">
                  <Link
                    to="/returns"
                    className="text-small font-semibold text-brand hover:underline"
                  >
                    {t.footer.returns} {lang === 'ar' ? '←' : '→'}
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </SectionReveal>
      </section>
    </div>
  )
}
