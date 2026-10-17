import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/i18n/LanguageProvider'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCustomerStats, useUpdateProfile, type ProfileFormState } from '@/features/account'
import { useGovernorates } from '@/features/delivery'
import {
  normalizeEgyptianPhone,
  isValidEgyptianPhone,
  normalizePostalCode,
  isValidPostalCode,
} from '@/features/checkout/validation'
import { formatEGP, formatNumber } from '@/lib/format'
import { useSeo } from '@/features/seo'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PearlLoader } from '@/components/ui/PearlLoader'
import { ErrorPanel } from '@/components/ui/ErrorPanel'
import { ErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/ui/ToastProvider'
import { Ltr } from '@/components/ui/Ltr'

export default function AccountPage() {
  const { t, lang } = useLanguage()
  const { user, profile, refreshProfile, signOut } = useAuth()
  const toast = useToast()

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useCustomerStats(Boolean(user))

  const { data: governorates = [], isLoading: govLoading } = useGovernorates()
  const updateMutation = useUpdateProfile()

  const [form, setForm] = useState<ProfileFormState>(() => ({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    alt_phone: profile?.alt_phone || '',
    governorate_id: profile?.governorate_id ?? '',
    city: profile?.city || '',
    district: profile?.district || '',
    address: profile?.address || '',
    postal_code: profile?.postal_code || '',
    floor: profile?.floor || '',
    apartment: profile?.apartment || '',
    landmark: profile?.landmark || '',
  }))

  const [profileLoaded, setProfileLoaded] = useState(false)
  if (!profileLoaded && profile) {
    setProfileLoaded(true)
    setForm({
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      alt_phone: profile.alt_phone || '',
      governorate_id: profile.governorate_id ?? '',
      city: profile.city || '',
      district: profile.district || '',
      address: profile.address || '',
      postal_code: profile.postal_code || '',
      floor: profile.floor || '',
      apartment: profile.apartment || '',
      landmark: profile.landmark || '',
    })
  }

  const [fieldErrors, setFieldErrors] = useState<{
    full_name?: string
    phone?: string
    alt_phone?: string
    postal_code?: string
  }>({})

  useSeo({
    title: t.account.details,
    description:
      lang === 'ar'
        ? 'تعديل بيانات الحساب وعناوين التوصيل في متجر لوليز'
        : "Manage your account details and delivery addresses at Lolys' Accessories & Home",
  })

  const validate = (): boolean => {
    const errors: {
      full_name?: string
      phone?: string
      alt_phone?: string
      postal_code?: string
    } = {}

    if (!form.full_name.trim()) {
      errors.full_name = t.account.nameRequired
    } else if (form.full_name.trim().length > 100) {
      errors.full_name = t.account.nameTooLong
    }

    const normPhone = normalizeEgyptianPhone(form.phone)
    if (!normPhone) {
      errors.phone = t.account.phoneRequired
    } else if (!isValidEgyptianPhone(normPhone)) {
      errors.phone = t.account.phoneInvalid
    }

    if (form.alt_phone.trim()) {
      const normAlt = normalizeEgyptianPhone(form.alt_phone)
      if (!isValidEgyptianPhone(normAlt)) {
        errors.alt_phone = t.account.altPhoneInvalid
      }
    }

    const hasAddress = Boolean(form.address.trim() || form.governorate_id)
    if (hasAddress) {
      const normPostal = normalizePostalCode(form.postal_code)
      if (!normPostal) {
        errors.postal_code = t.account.postalCodeRequired
      } else if (!isValidPostalCode(normPostal)) {
        errors.postal_code = t.account.postalCodeInvalid
      }
    } else if (form.postal_code.trim()) {
      if (!isValidPostalCode(form.postal_code)) {
        errors.postal_code = t.account.postalCodeInvalid
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!validate()) return

    try {
      await updateMutation.mutateAsync({
        userId: user.id,
        data: {
          full_name: form.full_name.trim(),
          phone: normalizeEgyptianPhone(form.phone) || null,
          alt_phone: form.alt_phone.trim() ? normalizeEgyptianPhone(form.alt_phone) : null,
          governorate_id: form.governorate_id === '' ? null : Number(form.governorate_id),
          city: form.city.trim() || null,
          district: form.district.trim() || null,
          address: form.address.trim() || null,
          postal_code: form.postal_code.trim() ? normalizePostalCode(form.postal_code) : null,
          floor: form.floor.trim() || null,
          apartment: form.apartment.trim() || null,
          landmark: form.landmark.trim() || null,
        },
      })

      await refreshProfile()
      toast.success(t.account.savedSuccess)
    } catch {
      // Handled via updateMutation.error in template
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Navigation */}
      <div className="rounded-card border border-border bg-surface p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-h1 font-bold font-accent text-brand">{t.account.details}</h1>
            {user?.email && (
              <span className="inline-flex items-center rounded-chip bg-surface-2 px-2.5 py-0.5 text-caption font-medium text-text-muted border border-border">
                <Ltr>{user.email}</Ltr>
              </span>
            )}
          </div>
          <p className="mt-2 text-body text-text-muted">{t.account.manageSubtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/account/orders"
            className="inline-flex h-11 items-center justify-center rounded-pill border border-border-input bg-surface-2 px-4 text-small font-semibold text-text hover:border-brand focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
          >
            {t.account.orders}
          </Link>
          <Link
            to="/account/favorites"
            className="inline-flex h-11 items-center justify-center rounded-pill border border-border-input bg-surface-2 px-4 text-small font-semibold text-text hover:border-brand focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
          >
            {t.account.favorites}
          </Link>
          <Link
            to="/account/security"
            className="inline-flex h-11 items-center justify-center rounded-pill border border-border-input bg-surface-2 px-4 text-small font-semibold text-text hover:border-brand focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
          >
            {t.account.security}
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              toast.success(lang === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully')
            }}
            className="inline-flex h-11 items-center justify-center rounded-pill border border-border-input bg-surface-2 px-4 text-small font-semibold text-text hover:border-danger hover:text-danger focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
          >
            {t.account.logout}
          </button>
        </div>
      </div>

      {/* Lifetime Customer Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsLoading ? (
          <div className="sm:col-span-3 rounded-card border border-border bg-surface p-6 flex justify-center text-brand">
            <PearlLoader loading />
          </div>
        ) : statsError ? (
          <div className="sm:col-span-3">
            <ErrorPanel error={statsErr} onRetry={() => void refetchStats()} />
          </div>
        ) : (
          <>
            {/* Total Spent */}
            <Card className="p-5 flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface-tint text-brand">
                <svg
                  className="size-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33"
                  />
                </svg>
              </div>
              <div>
                <p className="text-small font-medium text-text-muted">{t.account.totalSpent}</p>
                <p className="text-h3 font-bold text-brand mt-0.5">
                  {formatEGP(stats?.total_spent ?? 0)}
                </p>
              </div>
            </Card>

            {/* Total Orders */}
            <Card className="p-5 flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface-tint text-brand">
                <svg
                  className="size-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-small font-medium text-text-muted">{t.account.ordersCount}</p>
                <p className="text-h3 font-bold text-text mt-0.5">
                  {formatNumber(stats?.orders_count ?? 0)}
                </p>
              </div>
            </Card>

            {/* Favorite Item */}
            <Card className="p-5 flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface-tint text-caramel">
                <svg
                  className="size-6 text-caramel"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-small font-medium text-text-muted">
                  {t.account.favoriteProduct}
                </p>
                {stats?.favorite_product_name ? (
                  stats.favorite_product_id ? (
                    <Link
                      to={`/product/${stats.favorite_product_id}`}
                      className="block text-body font-bold text-brand hover:underline truncate mt-0.5"
                    >
                      {stats.favorite_product_name}
                    </Link>
                  ) : (
                    <p className="text-body font-bold text-text truncate mt-0.5">
                      {stats.favorite_product_name}
                    </p>
                  )
                ) : (
                  <p className="text-small text-text-muted mt-0.5">{t.account.noOrders}</p>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Profile Edit Form */}
      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="border-b border-border pb-4">
            <h2 className="text-h3 font-bold text-brand">{t.account.personalInfo}</h2>
            <p className="text-small text-text-muted mt-1">{t.account.personalInfoDesc}</p>
          </div>

          {updateMutation.isError && (
            <div role="alert">
              <ErrorMessage error={updateMutation.error} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <Input
                label={t.account.fullName}
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                maxLength={100}
                placeholder={lang === 'ar' ? 'أحمد محمد' : 'Rana Mohamed'}
              />
              {fieldErrors.full_name && (
                <p className="text-small text-danger mt-1">{fieldErrors.full_name}</p>
              )}
            </div>

            {/* Primary Phone */}
            <div>
              <Input
                label={t.account.primaryPhone}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                placeholder="01012345678"
                type="tel"
                dir="ltr"
              />
              {fieldErrors.phone && (
                <p className="text-small text-danger mt-1">{fieldErrors.phone}</p>
              )}
            </div>

            {/* Alternative Phone */}
            <div className="sm:col-span-2">
              <Input
                label={t.account.altPhone}
                value={form.alt_phone}
                onChange={(e) => setForm({ ...form, alt_phone: e.target.value })}
                placeholder="01112345678"
                type="tel"
                dir="ltr"
              />
              {fieldErrors.alt_phone && (
                <p className="text-small text-danger mt-1">{fieldErrors.alt_phone}</p>
              )}
            </div>
          </div>

          <div className="border-b border-border pb-4 pt-4">
            <h2 className="text-h3 font-bold text-brand">{t.account.shippingAddress}</h2>
            <p className="text-small text-text-muted mt-1">{t.account.shippingAddressDesc}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Governorate */}
            <div>
              <Select
                label={t.account.governorate}
                value={form.governorate_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    governorate_id: e.target.value ? Number(e.target.value) : '',
                  })
                }
                disabled={govLoading}
              >
                <option value="">{t.account.selectGov}</option>
                {governorates.map((gov) => (
                  <option key={gov.id} value={gov.id}>
                    {lang === 'ar' ? gov.name_ar : gov.name_en || gov.name_ar}
                  </option>
                ))}
              </Select>
            </div>

            {/* City */}
            <div>
              <Input
                label={t.account.city}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                maxLength={150}
                placeholder={lang === 'ar' ? 'المنصورة / مدينة نصر' : 'Alexandria / Cairo'}
              />
            </div>

            {/* District */}
            <div>
              <Input
                label={t.account.district}
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                maxLength={150}
                placeholder={lang === 'ar' ? 'حي الجامعة' : 'Sidi Gaber'}
              />
            </div>

            {/* Street Address */}
            <div>
              <Input
                label={t.account.street}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                maxLength={150}
                placeholder={lang === 'ar' ? 'شارع الجمهورية - عمارة 12' : '12 El Gomhouria St'}
              />
            </div>

            {/* Postal Code */}
            <div>
              <Input
                label={t.account.postalCode}
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                maxLength={5}
                placeholder={t.account.postalCodeHint}
                dir="ltr"
              />
              {fieldErrors.postal_code && (
                <p className="text-small text-danger mt-1">{fieldErrors.postal_code}</p>
              )}
            </div>

            {/* Floor */}
            <div>
              <Input
                label={t.account.floor}
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                maxLength={50}
                placeholder={lang === 'ar' ? 'الدور الرابع' : '4th Floor'}
              />
            </div>

            {/* Apartment */}
            <div>
              <Input
                label={t.account.apartment}
                value={form.apartment}
                onChange={(e) => setForm({ ...form, apartment: e.target.value })}
                maxLength={50}
                placeholder={lang === 'ar' ? 'شقة 8' : 'Apt 8'}
              />
            </div>

            {/* Landmark */}
            <div className="sm:col-span-2">
              <Input
                label={t.account.landmark}
                value={form.landmark}
                onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                maxLength={150}
                placeholder={
                  lang === 'ar' ? 'بجوار مسجد النور / أمام صيدلية العزبي' : 'Near Al-Nour Mosque'
                }
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
            <Link
              to="/account/security"
              className="text-small text-brand hover:underline font-medium"
            >
              {t.account.securityLink}
            </Link>

            <Button
              type="submit"
              variant="primary"
              disabled={updateMutation.isPending}
              className="w-full sm:w-auto min-w-[160px]"
            >
              {updateMutation.isPending ? t.account.saving : t.account.saveChanges}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
