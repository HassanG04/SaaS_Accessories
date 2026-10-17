import { useState, useId } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '@/i18n/LanguageProvider'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCart } from '@/features/cart'
import { useGovernorates, useDeliveryFees } from '@/features/delivery/hooks'
import { usePublicSettings } from '@/features/settings/hooks'
import {
  placeOrderApi,
  validateShippingForm,
  buildPlaceOrderShippingPayload,
  type ShippingAddressForm,
  type DeliveryMethod,
  type PaymentMethod,
  type ValidationErrors,
} from '@/features/checkout'
import { ProductImage } from '@/features/catalog/components/ProductImage'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorPanel } from '@/components/ui/ErrorPanel'
import { Skeleton } from '@/components/ui/Skeleton'
import { Ltr } from '@/components/ui/Ltr'
import { formatEGP } from '@/lib/format'
import { toAppError, AppError } from '@/lib/errors'
import { useSeo } from '@/features/seo'

export default function CheckoutPage() {
  const { t, lang } = useLanguage()
  const { user, profile, resendConfirmation } = useAuth()
  const { lines, subtotal, clearCart } = useCart()
  const navigate = useNavigate()

  const isEmailVerified = !user || Boolean(user.email_confirmed_at || user.confirmed_at)
  const [isResendingConfirm, setIsResendingConfirm] = useState(false)
  const [confirmResent, setConfirmResent] = useState(false)

  async function handleResendEmail() {
    if (isResendingConfirm || !user?.email) return
    setIsResendingConfirm(true)
    try {
      const result = await resendConfirmation({ email: user.email })
      if (result.success) {
        setConfirmResent(true)
      }
    } finally {
      setIsResendingConfirm(false)
    }
  }

  useSeo({
    title: t.checkout.title,
    description:
      lang === 'ar'
        ? 'إتمام الطلب وبيانات التوصيل في متجر لوليز'
        : 'Complete your order and delivery details at Lolys store',
  })

  // Form State
  const [formData, setFormData] = useState<ShippingAddressForm>({
    name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    alt_phone: profile?.alt_phone ?? '',
    governorate_id: profile?.governorate_id ?? '',
    city: profile?.city ?? '',
    district: profile?.district ?? '',
    address: profile?.address ?? '',
    postal_code: profile?.postal_code ?? '',
    floor: profile?.floor ?? '',
    apartment: profile?.apartment ?? '',
    landmark: profile?.landmark ?? '',
    notes: '',
  })
  const [saveAddress, setSaveAddress] = useState(true)

  // Prefill synchronization when profile loads
  const [profileLoaded, setProfileLoaded] = useState(false)
  if (!profileLoaded && profile) {
    setProfileLoaded(true)
    setFormData((prev) => ({
      name: prev.name || profile.full_name || '',
      phone: prev.phone || profile.phone || '',
      alt_phone: prev.alt_phone || profile.alt_phone || '',
      governorate_id: prev.governorate_id || profile.governorate_id || '',
      city: prev.city || profile.city || '',
      district: prev.district || profile.district || '',
      address: prev.address || profile.address || '',
      postal_code: prev.postal_code || profile.postal_code || '',
      floor: prev.floor || profile.floor || '',
      apartment: prev.apartment || profile.apartment || '',
      landmark: prev.landmark || profile.landmark || '',
      notes: prev.notes,
    }))
  }

  // Delivery & Payment Choices
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<DeliveryMethod | ''>('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | ''>('')

  // Validation & Submission States
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AppError | null>(null)

  // External Data
  const { data: governorates, isLoading: loadingGovs } = useGovernorates()
  const selectedGovId =
    typeof formData.governorate_id === 'number' && formData.governorate_id > 0
      ? formData.governorate_id
      : null

  const { data: deliveryFees, isLoading: loadingFees } = useDeliveryFees(selectedGovId)
  const { data: settings } = usePublicSettings()
  const requireApproval = settings?.require_order_approval ?? true

  // Delivery methods available for the chosen governorate
  const availableDeliveryOptions = deliveryFees ?? []

  // Ensure delivery method is synced with available options
  const activeDeliveryMethod: DeliveryMethod | '' =
    selectedDeliveryMethod &&
    availableDeliveryOptions.some((opt) => opt.method === selectedDeliveryMethod)
      ? selectedDeliveryMethod
      : (availableDeliveryOptions[0]?.method ?? '')

  // Enabled payment methods from public settings (default: ['cod', 'instapay_qr'])
  const enabledPaymentMethods: PaymentMethod[] = (() => {
    const fromSettings = settings?.payment_methods_enabled
    if (Array.isArray(fromSettings) && fromSettings.length > 0) {
      return fromSettings.filter((m): m is PaymentMethod => m === 'cod' || m === 'instapay_qr')
    }
    return ['cod', 'instapay_qr']
  })()

  // Ensure payment method is valid
  const activePaymentMethod: PaymentMethod | '' =
    selectedPaymentMethod && enabledPaymentMethods.includes(selectedPaymentMethod)
      ? selectedPaymentMethod
      : (enabledPaymentMethods[0] ?? '')

  // Selected Delivery Fee amount
  const selectedDeliveryFeeOption = availableDeliveryOptions.find(
    (opt) => opt.method === activeDeliveryMethod,
  )
  const shippingFee = selectedDeliveryFeeOption ? selectedDeliveryFeeOption.fee : 0
  const total = subtotal + shippingFee

  // Input Change Handler
  const handleInputChange = (field: keyof ShippingAddressForm, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
    if (submitError) setSubmitError(null)
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (user && !isEmailVerified) {
      setSubmitError(new AppError('AUTH-014'))
      return
    }

    const validation = validateShippingForm(formData, {
      isDeliveryMethodSelected: Boolean(activeDeliveryMethod),
      isPaymentMethodSelected: Boolean(activePaymentMethod),
    })

    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    if (!activeDeliveryMethod) {
      setErrors((prev) => ({
        ...prev,
        delivery_method: t.checkout.noDeliveryMethods,
      }))
      return
    }

    if (!activePaymentMethod) {
      setErrors((prev) => ({
        ...prev,
        payment_method: t.checkout.noPaymentMethods,
      }))
      return
    }

    setIsSubmitting(true)

    try {
      const payloadItems = lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
      }))

      const shippingPayload = buildPlaceOrderShippingPayload(formData)

      const orderId = await placeOrderApi({
        items: payloadItems,
        delivery_method: activeDeliveryMethod,
        payment_method: activePaymentMethod,
        ship: shippingPayload,
        save_address: saveAddress,
      })

      // Clear shopping cart on successful checkout
      clearCart()

      // Route according to payment method
      if (activePaymentMethod === 'cod') {
        navigate(`/order/${orderId}/thanks`)
      } else {
        navigate(`/pay/${orderId}`)
      }
    } catch (err) {
      setSubmitError(toAppError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Unique IDs for accessibility
  const nameId = useId()
  const phoneId = useId()
  const altPhoneId = useId()
  const govId = useId()
  const cityId = useId()
  const districtId = useId()
  const addressId = useId()
  const postalCodeId = useId()
  const floorId = useId()
  const aptId = useId()
  const landmarkId = useId()
  const notesId = useId()
  const saveAddressId = useId()

  if (lines.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          title={t.cart.empty}
          description={t.cart.emptyDesc}
          action={
            <Link
              to="/category/all"
              className="inline-flex h-11 items-center justify-center rounded-pill bg-brand px-6 text-body font-semibold text-brand-contrast transition-opacity hover:opacity-90"
            >
              {t.cart.browseProducts}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-h1 font-bold font-accent text-brand">{t.checkout.title}</h1>
        <p className="mt-1 text-body text-text-muted">{t.checkout.addressDetails}</p>
      </div>

      {submitError && (
        <ErrorPanel
          error={submitError}
          onRetry={() => void handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
          retryLabel={t.ui.retry}
        />
      )}

      {user && !isEmailVerified && (
        <div
          role="alert"
          className="rounded-card border border-warning/40 bg-warning/10 p-4 text-text space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-warning/20 text-warning">
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-body font-bold text-text">{t.auth.checkYourEmail}</h2>
              <p className="text-small text-text-muted">{t.auth.emailVerificationRequired}</p>
            </div>
          </div>
          <div className="pt-1">
            {confirmResent ? (
              <p role="status" className="text-small font-semibold text-brand">
                {t.auth.checkEmailDesc}
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={isResendingConfirm}
                className="inline-flex h-9 items-center justify-center rounded-pill border border-border bg-surface px-4 text-caption font-semibold text-brand hover:bg-surface-tint focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
              >
                {isResendingConfirm ? t.auth.sendingConfirmationLink : t.auth.resendNoticeLink}
              </button>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Main Form: Location & Choices (col-span 7) */}
        <div className="lg:col-span-7 space-y-8">
          {/* 1. Contact Information Card */}
          <Card className="p-6 sm:p-8 space-y-6">
            <h2 className="text-h3 font-bold font-accent text-brand">
              {lang === 'ar' ? 'معلومات المستلم' : 'Recipient Information'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor={nameId} className="block text-small font-semibold text-text">
                  {t.field.name} <span className="text-danger">*</span>
                </label>
                <input
                  id={nameId}
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  maxLength={100}
                  className={`w-full h-11 rounded-pill border bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus ${
                    errors.name ? 'border-danger' : 'border-border-input'
                  }`}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${nameId}-error` : undefined}
                />
                {errors.name && (
                  <p id={`${nameId}-error`} role="alert" className="text-small text-danger">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Mobile Phone */}
              <div className="space-y-1">
                <label htmlFor={phoneId} className="block text-small font-semibold text-text">
                  {t.field.phone} <span className="text-danger">*</span>
                </label>
                <input
                  id={phoneId}
                  type="tel"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder={t.checkout.phoneFormatHint}
                  maxLength={20}
                  className={`w-full h-11 rounded-pill border bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus ${
                    errors.phone ? 'border-danger' : 'border-border-input'
                  }`}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
                />
                {errors.phone && (
                  <p id={`${phoneId}-error`} role="alert" className="text-small text-danger">
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* Alternative Phone */}
              <div className="space-y-1">
                <label htmlFor={altPhoneId} className="block text-small font-semibold text-text">
                  {t.field.phone2}
                </label>
                <input
                  id={altPhoneId}
                  type="tel"
                  dir="ltr"
                  value={formData.alt_phone}
                  onChange={(e) => handleInputChange('alt_phone', e.target.value)}
                  placeholder={t.checkout.phoneFormatHint}
                  maxLength={20}
                  className={`w-full h-11 rounded-pill border bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus ${
                    errors.alt_phone ? 'border-danger' : 'border-border-input'
                  }`}
                  aria-invalid={Boolean(errors.alt_phone)}
                  aria-describedby={errors.alt_phone ? `${altPhoneId}-error` : undefined}
                />
                {errors.alt_phone && (
                  <p id={`${altPhoneId}-error`} role="alert" className="text-small text-danger">
                    {errors.alt_phone}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* 2. Delivery Address Card */}
          <Card className="p-6 sm:p-8 space-y-6">
            <h2 className="text-h3 font-bold font-accent text-brand">
              {lang === 'ar' ? 'عنوان التوصيل' : 'Delivery Address'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Governorate Dropdown */}
              <div className="space-y-1">
                <label htmlFor={govId} className="block text-small font-semibold text-text">
                  {t.field.governorate} <span className="text-danger">*</span>
                </label>
                <select
                  id={govId}
                  value={formData.governorate_id}
                  disabled={loadingGovs}
                  onChange={(e) =>
                    handleInputChange(
                      'governorate_id',
                      e.target.value ? Number(e.target.value) : '',
                    )
                  }
                  className={`w-full h-11 rounded-pill border bg-surface px-4 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus ${
                    errors.governorate_id ? 'border-danger' : 'border-border-input'
                  }`}
                  aria-invalid={Boolean(errors.governorate_id)}
                  aria-describedby={errors.governorate_id ? `${govId}-error` : undefined}
                >
                  <option value="">
                    {lang === 'ar' ? '-- اختر المحافظة --' : '-- Select Governorate --'}
                  </option>
                  {(governorates ?? []).map((gov) => (
                    <option key={gov.id} value={gov.id}>
                      {lang === 'ar' ? gov.name_ar : gov.name_en}
                    </option>
                  ))}
                </select>
                {errors.governorate_id && (
                  <p id={`${govId}-error`} role="alert" className="text-small text-danger">
                    {errors.governorate_id}
                  </p>
                )}
              </div>

              {/* City / Center */}
              <div className="space-y-1">
                <label htmlFor={cityId} className="block text-small font-semibold text-text">
                  {t.field.city}
                </label>
                <input
                  id={cityId}
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  maxLength={150}
                  className="w-full h-11 rounded-pill border border-border-input bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>

              {/* District */}
              <div className="space-y-1">
                <label htmlFor={districtId} className="block text-small font-semibold text-text">
                  {t.field.district}
                </label>
                <input
                  id={districtId}
                  type="text"
                  value={formData.district}
                  onChange={(e) => handleInputChange('district', e.target.value)}
                  maxLength={150}
                  className="w-full h-11 rounded-pill border border-border-input bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>

              {/* Street & Building (Required) */}
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor={addressId} className="block text-small font-semibold text-text">
                  {t.field.address} <span className="text-danger">*</span>
                </label>
                <input
                  id={addressId}
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  maxLength={150}
                  placeholder={
                    lang === 'ar' ? 'اسم الشارع ورقم المبنى' : 'Street name and building number'
                  }
                  className={`w-full h-11 rounded-pill border bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus ${
                    errors.address ? 'border-danger' : 'border-border-input'
                  }`}
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? `${addressId}-error` : undefined}
                />
                {errors.address && (
                  <p id={`${addressId}-error`} role="alert" className="text-small text-danger">
                    {errors.address}
                  </p>
                )}
              </div>

              {/* Postal Code (Required) */}
              <div className="space-y-1">
                <label htmlFor={postalCodeId} className="block text-small font-semibold text-text">
                  {t.field.postalCode} <span className="text-danger">*</span>
                </label>
                <input
                  id={postalCodeId}
                  type="text"
                  dir="ltr"
                  value={formData.postal_code}
                  onChange={(e) => handleInputChange('postal_code', e.target.value)}
                  maxLength={5}
                  placeholder={t.checkout.postalCodeHint}
                  className={`w-full h-11 rounded-pill border bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus ${
                    errors.postal_code ? 'border-danger' : 'border-border-input'
                  }`}
                  aria-invalid={Boolean(errors.postal_code)}
                  aria-describedby={errors.postal_code ? `${postalCodeId}-error` : undefined}
                />
                {errors.postal_code && (
                  <p id={`${postalCodeId}-error`} role="alert" className="text-small text-danger">
                    {errors.postal_code}
                  </p>
                )}
              </div>

              {/* Floor */}
              <div className="space-y-1">
                <label htmlFor={floorId} className="block text-small font-semibold text-text">
                  {t.field.floor}
                </label>
                <input
                  id={floorId}
                  type="text"
                  value={formData.floor}
                  onChange={(e) => handleInputChange('floor', e.target.value)}
                  maxLength={50}
                  className="w-full h-11 rounded-pill border border-border-input bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>

              {/* Apartment */}
              <div className="space-y-1">
                <label htmlFor={aptId} className="block text-small font-semibold text-text">
                  {t.field.apartment}
                </label>
                <input
                  id={aptId}
                  type="text"
                  value={formData.apartment}
                  onChange={(e) => handleInputChange('apartment', e.target.value)}
                  maxLength={50}
                  className="w-full h-11 rounded-pill border border-border-input bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>

              {/* Landmark */}
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor={landmarkId} className="block text-small font-semibold text-text">
                  {t.field.landmark}
                </label>
                <input
                  id={landmarkId}
                  type="text"
                  value={formData.landmark}
                  onChange={(e) => handleInputChange('landmark', e.target.value)}
                  maxLength={150}
                  placeholder={
                    lang === 'ar'
                      ? 'بجوار مدرسة أو مسجد أو متجر معروف'
                      : 'Near a school, mosque, or landmark'
                  }
                  className="w-full h-11 rounded-pill border border-border-input bg-surface px-4 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>

              {/* Delivery Notes */}
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor={notesId} className="block text-small font-semibold text-text">
                  {t.field.notes}
                </label>
                <textarea
                  id={notesId}
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  maxLength={500}
                  placeholder={
                    lang === 'ar'
                      ? 'أي تعليمات إضافية لمندوب التوصيل'
                      : 'Any additional instructions for the delivery courier'
                  }
                  className="w-full rounded-image border border-border-input bg-surface p-3 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>

              {/* Save Address Checkbox */}
              <div className="sm:col-span-2 pt-2">
                <label
                  htmlFor={saveAddressId}
                  className="flex items-center gap-3 cursor-pointer select-none"
                >
                  <input
                    id={saveAddressId}
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="size-5 rounded-chip border-border-input text-brand focus:ring-focus"
                  />
                  <span className="text-small font-medium text-text">
                    {t.checkout.save_address ||
                      (lang === 'ar'
                        ? 'احفظ هذا العنوان لطلباتي القادمة'
                        : 'Save this address for future orders')}
                  </span>
                </label>
              </div>
            </div>
          </Card>

          {/* 3. Delivery Method Cards */}
          <Card className="p-6 sm:p-8 space-y-4">
            <h2 className="text-h3 font-bold font-accent text-brand">{t.checkout.delivery}</h2>

            {!formData.governorate_id ? (
              <p className="rounded-chip border border-border bg-surface-2 p-4 text-small text-text-muted">
                {t.checkout.selectGovernorateFirst}
              </p>
            ) : loadingFees ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-chip" />
                <Skeleton className="h-16 w-full rounded-chip" />
              </div>
            ) : availableDeliveryOptions.length === 0 ? (
              <p
                role="alert"
                className="rounded-chip border border-danger/20 bg-surface-tint p-4 text-small text-danger"
              >
                {t.checkout.noDeliveryMethods}
              </p>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                role="radiogroup"
                aria-label={t.checkout.delivery}
              >
                {availableDeliveryOptions.map((opt) => {
                  const isSelected = activeDeliveryMethod === opt.method
                  return (
                    <button
                      key={opt.method}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedDeliveryMethod(opt.method)}
                      className={`flex flex-col justify-between p-4 rounded-chip border text-start transition-all focus:outline-none focus:ring-2 focus:ring-focus ${
                        isSelected
                          ? 'border-brand bg-surface-tint shadow-pill ring-1 ring-brand'
                          : 'border-border bg-surface hover:border-brand'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-text">
                          {lang === 'ar' ? opt.label_ar : opt.label_en}
                        </span>
                        <div
                          className={`size-4 rounded-pill border flex items-center justify-center ${
                            isSelected ? 'border-brand bg-brand' : 'border-border-input'
                          }`}
                        >
                          {isSelected && (
                            <div className="size-1.5 rounded-pill bg-brand-contrast" />
                          )}
                        </div>
                      </div>
                      <span className="mt-2 text-small font-bold text-brand">
                        {formatEGP(opt.fee)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {errors.delivery_method && (
              <p role="alert" className="text-small text-danger">
                {errors.delivery_method}
              </p>
            )}
          </Card>

          {/* 4. Payment Method Cards */}
          <Card className="p-6 sm:p-8 space-y-4">
            <h2 className="text-h3 font-bold font-accent text-brand">{t.checkout.payment}</h2>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              role="radiogroup"
              aria-label={t.checkout.payment}
            >
              {enabledPaymentMethods.map((method) => {
                const isSelected = activePaymentMethod === method
                const isCod = method === 'cod'
                return (
                  <button
                    key={method}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`flex flex-col justify-between p-4 rounded-chip border text-start transition-all focus:outline-none focus:ring-2 focus:ring-focus ${
                      isSelected
                        ? 'border-brand bg-surface-tint shadow-pill ring-1 ring-brand'
                        : 'border-border bg-surface hover:border-brand'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-text">
                        {isCod ? t.payment.cod : t.payment.instapay}
                      </span>
                      <div
                        className={`size-4 rounded-pill border flex items-center justify-center ${
                          isSelected ? 'border-brand bg-brand' : 'border-border-input'
                        }`}
                      >
                        {isSelected && <div className="size-1.5 rounded-pill bg-brand-contrast" />}
                      </div>
                    </div>
                    <p className="mt-2 text-caption text-text-muted">
                      {isCod ? t.checkout.codDescription : t.checkout.instapayDescription}
                    </p>
                    {!isCod && (
                      <span className="mt-2 inline-block self-start rounded-pill bg-brand/10 px-2 py-0.5 text-caption font-semibold text-brand">
                        {t.checkout.fastAndSecure}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {errors.payment_method && (
              <p role="alert" className="text-small text-danger">
                {errors.payment_method}
              </p>
            )}
          </Card>
        </div>

        {/* Order Summary & Submit Sidebar (col-span 5) */}
        <div className="lg:col-span-5 sticky top-20 space-y-6">
          <Card className="p-6 sm:p-8 space-y-6 shadow-card">
            <h2 className="text-h3 font-bold font-accent text-brand">
              {t.checkout.estimateSummary}
            </h2>

            {/* Cart Items List */}
            <div className="divide-y divide-border max-h-72 overflow-y-auto pe-1">
              {lines.map((line) => (
                <div key={line.productId} className="flex items-center gap-3 py-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-image border border-border">
                    <ProductImage
                      src={line.product?.image_url}
                      alt={line.product?.name ?? ''}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-small font-semibold text-text truncate">
                      {lang === 'ar'
                        ? line.product?.name_ar || line.product?.name
                        : line.product?.name}
                    </h3>
                    <p className="text-caption text-text-muted">
                      {line.quantity} × {formatEGP(line.unitPrice)}
                    </p>
                  </div>
                  <span className="text-small font-bold text-text">
                    {formatEGP(line.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 border-t border-border pt-4 text-small">
              <div className="flex justify-between text-text">
                <span>{t.cart.subtotal}</span>
                <span className="font-semibold">{formatEGP(subtotal)}</span>
              </div>

              <div className="flex justify-between text-text">
                <span>{t.cart.shipping}</span>
                <span className="font-semibold">
                  {activeDeliveryMethod && selectedDeliveryFeeOption
                    ? formatEGP(shippingFee)
                    : t.cart.shippingCalculated}
                </span>
              </div>

              <div className="flex justify-between items-baseline border-t border-border pt-3 text-body font-bold text-text">
                <span>{t.cart.total}</span>
                <span className="text-h2 font-accent text-brand">
                  <Ltr>{formatEGP(total)}</Ltr>
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || (Boolean(user) && !isEmailVerified)}
                className="w-full h-12 flex items-center justify-center rounded-pill bg-brand px-6 text-body font-semibold text-brand-contrast transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-focus shadow-pill"
              >
                {isSubmitting
                  ? t.checkout.submitting
                  : Boolean(user) && !isEmailVerified
                    ? t.auth.emailVerificationRequired
                    : activePaymentMethod === 'instapay_qr' && requireApproval
                      ? t.checkout.submit_request ||
                        (lang === 'ar' ? 'إرسال الطلب' : 'Submit Order Request')
                      : t.checkout.submit}
              </button>

              {activePaymentMethod === 'instapay_qr' && requireApproval && (
                <p className="text-center text-caption text-text-muted">
                  {t.checkout.approval_note ||
                    (lang === 'ar'
                      ? 'سنراجع طلبك أولًا، ثم نرسل لك رابط الدفع.'
                      : 'We will review your order first, then send you the payment link.')}
                </p>
              )}

              <p className="text-center text-caption text-text-muted leading-relaxed">
                {lang === 'ar'
                  ? 'بإتمامك للطلب، فإنك توافق على '
                  : 'By placing your order, you agree to our '}
                <Link to="/terms" target="_blank" className="text-brand underline hover:opacity-80">
                  {t.footer.terms}
                </Link>
                {lang === 'ar' ? ' و' : ', '}
                <Link
                  to="/privacy"
                  target="_blank"
                  className="text-brand underline hover:opacity-80"
                >
                  {t.footer.privacy}
                </Link>
                {lang === 'ar' ? ' و' : ' and '}
                <Link
                  to="/returns"
                  target="_blank"
                  className="text-brand underline hover:opacity-80"
                >
                  {t.footer.returns}
                </Link>
                .
              </p>

              <Link
                to="/cart"
                className="w-full h-11 flex items-center justify-center rounded-pill border border-border bg-surface-2 px-6 text-small font-semibold text-text hover:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
              >
                {lang === 'ar' ? 'العودة إلى السلة' : 'Back to Cart'}
              </Link>
            </div>
          </Card>
        </div>
      </form>
    </div>
  )
}
