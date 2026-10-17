import { lazy, Suspense, useState, type FormEvent, type ChangeEvent } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { PearlLoader } from '@/components/ui/PearlLoader'
import { ErrorPanel } from '@/components/ui/ErrorPanel'
import { ErrorMessage } from '@/lib/errors'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/i18n/LanguageProvider'
import { formatDate } from '@/lib/format'
import { StepUpDialog } from '@/features/auth/StepUpDialog'
import { useStepUp } from '@/features/auth/useStepUp'
import {
  useAdminSettings,
  useUpdateAdminSetting,
  useUploadInstaPayQr,
  useRecentSettingsAudit,
} from './hooks'
import { getPublicQrUrl } from './api'
import type { ShopSettingsMap, SettingKey, SettingsAuditEntry } from './types'

const ContentEditorLauncher = lazy(() => import('@/features/admin/settings/ContentEditorLauncher'))

export const SETTING_LABELS: Record<SettingKey, { ar: string; en: string }> = {
  shop_name_ar: { ar: 'اسم المتجر (بالعربية)', en: 'Shop Name (Arabic)' },
  shop_name_en: { ar: 'اسم المتجر (بالإنجليزية)', en: 'Shop Name (English)' },
  tagline_ar: { ar: 'الشعار النصي', en: 'Tagline' },
  phone: { ar: 'رقم الهاتف', en: 'Phone Number' },
  whatsapp: { ar: 'رقم الواتساب', en: 'WhatsApp Number' },
  instagram: { ar: 'رابط الإنستغرام', en: 'Instagram URL' },
  announcement_ar: { ar: 'شريط الإعلانات', en: 'Announcement Bar' },
  hero_title_ar: { ar: 'عنوان الواجهة الرئيسية', en: 'Hero Title' },
  hero_subtitle_ar: { ar: 'النص التعريفي للواجهة', en: 'Hero Subtitle' },
  sale_percent: { ar: 'نسبة الخصم العامة (%)', en: 'Sale Discount (%)' },
  payment_methods_enabled: { ar: 'طرق الدفع المفعلة', en: 'Enabled Payment Methods' },
  instapay_qr_path: { ar: 'رمز استجابة إنستاباي (QR)', en: 'InstaPay QR Code' },
  instapay_handle: { ar: 'عنوان حساب إنستاباي (IPA)', en: 'InstaPay Handle' },
  returns_text_ar: { ar: 'نص سياسة الاسترجاع', en: 'Returns Policy' },
  payment_window_hours: { ar: 'مهلة سداد إنستاباي (ساعات)', en: 'Payment Window (hours)' },
  pending_order_limit: { ar: 'حد الطلبات المعلقة للعميل', en: 'Pending Order Limit' },
}

export default function SettingsPage() {
  const { lang } = useLanguage()
  const isAr = lang === 'ar'
  const toast = useToast()

  const { data: initialSettings, isLoading, error, refetch } = useAdminSettings()
  const updateMutation = useUpdateAdminSetting()
  const uploadQrMutation = useUploadInstaPayQr()
  const { data: auditLogs = [], isLoading: isAuditLoading } = useRecentSettingsAudit()

  const { isConfirmed, openStepUp, dialogOpen: isStepUpOpen, closeStepUp } = useStepUp()

  // Local overrides state to avoid cascading renders in useEffect
  const [overrides, setOverrides] = useState<Partial<ShopSettingsMap>>({})
  const [activeTab, setActiveTab] = useState<'general' | 'hero' | 'payment' | 'limits' | 'audit'>(
    'general',
  )
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [sectionError, setSectionError] = useState<unknown | null>(null)

  const form: ShopSettingsMap | null = initialSettings ? { ...initialSettings, ...overrides } : null

  if (isLoading || !form) {
    return (
      <div
        role="status"
        aria-label={isAr ? 'جارٍ تحميل الإعدادات' : 'Loading settings'}
        className="flex h-64 items-center justify-center text-brand"
      >
        <PearlLoader loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorPanel
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  const handleTextChange = (key: SettingKey, value: string) => {
    setOverrides((prev) => ({ ...prev, [key]: value }))
  }

  const handleNumberChange = (key: SettingKey, value: number) => {
    setOverrides((prev) => ({ ...prev, [key]: value }))
  }

  const handlePaymentMethodToggle = (method: 'cod' | 'instapay_qr') => {
    if (!form) return
    const current = form.payment_methods_enabled || []
    const exists = current.includes(method)
    let next: ('cod' | 'instapay_qr')[]
    if (exists) {
      next = current.filter((m) => m !== method)
    } else {
      next = [...current, method]
    }
    // Must keep at least one method enabled
    if (next.length === 0) {
      toast.error(
        isAr
          ? 'يجب تفعيل طريقة دفع واحدة على الأقل.'
          : 'At least one payment method must remain enabled.',
      )
      return
    }
    setOverrides((prev) => ({ ...prev, payment_methods_enabled: next }))
  }

  const saveGeneral = async (e: FormEvent) => {
    e.preventDefault()
    setSectionError(null)
    setSavingKey('general')
    try {
      await updateMutation.mutateAsync({ key: 'shop_name_ar', value: form.shop_name_ar })
      await updateMutation.mutateAsync({ key: 'shop_name_en', value: form.shop_name_en })
      await updateMutation.mutateAsync({ key: 'tagline_ar', value: form.tagline_ar })
      await updateMutation.mutateAsync({ key: 'phone', value: form.phone })
      await updateMutation.mutateAsync({ key: 'whatsapp', value: form.whatsapp })
      await updateMutation.mutateAsync({ key: 'instagram', value: form.instagram })
      toast.success(isAr ? 'تم حفظ معلومات المتجر والتواصل بنجاح' : 'Shop info saved successfully')
    } catch (err) {
      setSectionError(err)
    } finally {
      setSavingKey(null)
    }
  }

  const saveHero = async (e: FormEvent) => {
    e.preventDefault()
    setSectionError(null)
    setSavingKey('hero')
    try {
      await updateMutation.mutateAsync({ key: 'announcement_ar', value: form.announcement_ar })
      await updateMutation.mutateAsync({ key: 'hero_title_ar', value: form.hero_title_ar })
      await updateMutation.mutateAsync({ key: 'hero_subtitle_ar', value: form.hero_subtitle_ar })
      await updateMutation.mutateAsync({ key: 'sale_percent', value: form.sale_percent })
      toast.success(
        isAr ? 'تم حفظ إعدادات الواجهة والخصم بنجاح' : 'Hero settings saved successfully',
      )
    } catch (err) {
      setSectionError(err)
    } finally {
      setSavingKey(null)
    }
  }

  const executeSavePayment = async () => {
    setSectionError(null)
    setSavingKey('payment')
    try {
      await updateMutation.mutateAsync({
        key: 'payment_methods_enabled',
        value: form.payment_methods_enabled,
      })
      await updateMutation.mutateAsync({ key: 'instapay_handle', value: form.instapay_handle })
      toast.success(
        isAr ? 'تم حفظ إعدادات الدفع وإنستاباي بنجاح' : 'Payment settings saved successfully',
      )
    } catch (err) {
      setSectionError(err)
    } finally {
      setSavingKey(null)
    }
  }

  const savePayment = (e: FormEvent) => {
    e.preventDefault()
    if (isConfirmed) {
      void executeSavePayment()
    } else {
      openStepUp(() => {
        void executeSavePayment()
      })
    }
  }

  const executeSaveLimits = async () => {
    setSectionError(null)
    setSavingKey('limits')
    try {
      await updateMutation.mutateAsync({
        key: 'pending_order_limit',
        value: form.pending_order_limit,
      })
      await updateMutation.mutateAsync({
        key: 'payment_window_hours',
        value: form.payment_window_hours,
      })
      await updateMutation.mutateAsync({ key: 'returns_text_ar', value: form.returns_text_ar })
      toast.success(
        isAr ? 'تم حفظ الحدود التشغيلية والسياسات بنجاح' : 'Operational limits saved successfully',
      )
    } catch (err) {
      setSectionError(err)
    } finally {
      setSavingKey(null)
    }
  }

  const saveLimits = (e: FormEvent) => {
    e.preventDefault()
    if (isConfirmed) {
      void executeSaveLimits()
    } else {
      openStepUp(() => {
        void executeSaveLimits()
      })
    }
  }

  const executeQrUpload = async (file: File) => {
    setSectionError(null)
    setSavingKey('qr')
    try {
      const newPath = await uploadQrMutation.mutateAsync({
        file,
        previousPath: form.instapay_qr_path,
      })
      setOverrides((prev) => ({ ...prev, instapay_qr_path: newPath }))
      toast.success(
        isAr ? 'تم تحديث واستبدال رمز QR لإنستاباي بنجاح' : 'InstaPay QR updated successfully',
      )
    } catch (err) {
      setSectionError(err)
    } finally {
      setSavingKey(null)
    }
  }

  const handleQrFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (isConfirmed) {
      void executeQrUpload(file)
    } else {
      openStepUp(() => {
        void executeQrUpload(file)
      })
    }
  }

  const renderAuditValue = (val: unknown) => {
    if (val === null || val === undefined) return <span className="text-text-muted">—</span>
    if (typeof val === 'object') {
      const record = val as Record<string, unknown>
      if ('value' in record) {
        return JSON.stringify(record.value)
      }
      return JSON.stringify(val)
    }
    return String(val)
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-h2 font-bold text-text">
            {isAr ? 'إعدادات المتجر' : 'Site Settings'}
          </h1>
          <p className="text-small text-text-muted">
            {isAr
              ? 'إدارة معلومات المتجر، قنوات التواصل، العروض، طرق الدفع، والسياسات'
              : 'Manage store details, contact channels, promotions, payment methods, and policies'}
          </p>
        </div>
      </div>

      {sectionError != null && (
        <div className="rounded-card border border-danger/30 bg-danger/10 p-4">
          <ErrorMessage error={sectionError} />
        </div>
      )}

      <Suspense fallback={null}>
        <ContentEditorLauncher />
      </Suspense>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === 'general' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('general')}
        >
          {isAr ? 'معلومات المتجر والتواصل' : 'Shop Info & Contact'}
        </Button>
        <Button
          variant={activeTab === 'hero' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('hero')}
        >
          {isAr ? 'الواجهة والخصم والإعلانات' : 'Storefront & Promotions'}
        </Button>
        <Button
          variant={activeTab === 'payment' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('payment')}
        >
          {isAr ? 'طرق الدفع وإنستاباي' : 'Payments & InstaPay'}
        </Button>
        <Button
          variant={activeTab === 'limits' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('limits')}
        >
          {isAr ? 'الحدود التشغيلية والسياسات' : 'Limits & Policies'}
        </Button>
        <Button
          variant={activeTab === 'audit' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('audit')}
        >
          {isAr ? 'سجل التغييرات' : 'Audit Log'}
        </Button>
      </div>

      {/* SECTION 1: General Info & Contact */}
      {activeTab === 'general' && (
        <Card className="p-6">
          <form onSubmit={saveGeneral} className="space-y-6">
            <h2 className="text-h3 font-bold text-text">
              {isAr ? 'معلومات المتجر والتواصل' : 'Shop Info & Contact Channels'}
            </h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Input
                label={isAr ? 'اسم المتجر (بالعربية)' : 'Shop Name (Arabic)'}
                value={form.shop_name_ar}
                onChange={(e) => handleTextChange('shop_name_ar', e.target.value)}
                maxLength={60}
                required
              />
              <Input
                label={isAr ? 'اسم المتجر (بالإنجليزية)' : 'Shop Name (English)'}
                value={form.shop_name_en}
                onChange={(e) => handleTextChange('shop_name_en', e.target.value)}
                maxLength={60}
                required
              />
            </div>

            <Input
              label={isAr ? 'الشعار النصي' : 'Tagline'}
              value={form.tagline_ar}
              onChange={(e) => handleTextChange('tagline_ar', e.target.value)}
              maxLength={120}
              hint={isAr ? 'عبارة قصيرة تظهر أسفل اسم المتجر' : 'Short phrase under shop name'}
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <Input
                label={isAr ? 'رقم الهاتف' : 'Phone Number'}
                value={form.phone}
                onChange={(e) => handleTextChange('phone', e.target.value)}
                maxLength={20}
                type="tel"
                dir="ltr"
              />
              <Input
                label={isAr ? 'رقم الواتساب' : 'WhatsApp Number'}
                value={form.whatsapp}
                onChange={(e) => handleTextChange('whatsapp', e.target.value)}
                maxLength={20}
                type="tel"
                dir="ltr"
              />
              <Input
                label={isAr ? 'رابط حساب الإنستغرام' : 'Instagram URL'}
                value={form.instagram}
                onChange={(e) => handleTextChange('instagram', e.target.value)}
                maxLength={100}
                type="url"
                dir="ltr"
                placeholder="https://instagram.com/lolys..."
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={savingKey === 'general'}>
                {savingKey === 'general'
                  ? isAr
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : isAr
                    ? 'حفظ التغييرات'
                    : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* SECTION 2: Hero & Promotions */}
      {activeTab === 'hero' && (
        <Card className="p-6">
          <form onSubmit={saveHero} className="space-y-6">
            <h2 className="text-h3 font-bold text-text">
              {isAr ? 'الواجهة الرئيسية والخصم والإعلانات' : 'Storefront, Hero & Promotions'}
            </h2>

            <Input
              label={isAr ? 'شريط الإعلانات أعلى المتجر' : 'Top Announcement Bar'}
              value={form.announcement_ar}
              onChange={(e) => handleTextChange('announcement_ar', e.target.value)}
              maxLength={200}
              hint={
                isAr
                  ? 'نص يظهر في الشريط العلوي للمتجر للترويج للعروض الخاصة (فارغ لإخفائه)'
                  : 'Text displayed in the top bar across the store (leave empty to hide)'
              }
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Input
                label={isAr ? 'عنوان الواجهة الرئيسية (Hero Title)' : 'Hero Title'}
                value={form.hero_title_ar}
                onChange={(e) => handleTextChange('hero_title_ar', e.target.value)}
                maxLength={120}
                required
              />
              <Field
                id="sale_percent_input"
                label={isAr ? 'نسبة الخصم العامة (%)' : 'Sale Discount (%)'}
                hint={isAr ? 'من 0% حتى 90%' : 'From 0% to 90%'}
              >
                <input
                  id="sale_percent_input"
                  type="number"
                  min={0}
                  max={90}
                  step={1}
                  value={form.sale_percent}
                  onChange={(e) => handleNumberChange('sale_percent', Number(e.target.value))}
                  className="ui-control ui-field block w-full rounded-pill border border-border-input bg-surface px-4 py-2 text-text"
                  required
                />
              </Field>
            </div>

            <Field
              id="hero_subtitle_input"
              label={isAr ? 'النص التعريفي للواجهة (Hero Subtitle)' : 'Hero Subtitle'}
              hint={isAr ? 'النص التوضيحي أسفل العنوان الرئيسي' : 'Text under hero title'}
            >
              <textarea
                id="hero_subtitle_input"
                rows={3}
                value={form.hero_subtitle_ar}
                onChange={(e) => handleTextChange('hero_subtitle_ar', e.target.value)}
                maxLength={240}
                className="ui-control ui-field block w-full rounded-card border border-border-input bg-surface p-3 text-text"
                required
              />
            </Field>

            {/* Live Storefront Preview */}
            <div className="rounded-card border border-border bg-surface-tint p-4">
              <span className="text-caption font-semibold text-text-muted block mb-2">
                {isAr ? 'معاينة شريط الخصم في الواجهة:' : 'Hero Badge Live Preview:'}
              </span>
              <div className="inline-flex items-center gap-2 rounded-pill bg-surface border border-border px-4 py-1.5 text-caption font-semibold text-brand shadow-pill">
                <span>
                  {isAr ? `خصم يصل إلى ${form.sale_percent}%` : `Up to ${form.sale_percent}% off`}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={savingKey === 'hero'}>
                {savingKey === 'hero'
                  ? isAr
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : isAr
                    ? 'حفظ التغييرات'
                    : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* SECTION 3: Payment Methods & InstaPay (Step-Up Guarded) */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          <Card className="p-6">
            <form onSubmit={savePayment} className="space-y-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-h3 font-bold text-text">
                  {isAr ? 'طرق الدفع المفعلة وحساب إنستاباي' : 'Payment Methods & InstaPay'}
                </h2>
                <span className="text-caption rounded-pill bg-warning/10 text-warning px-3 py-1 font-semibold border border-warning/30">
                  {isAr ? 'إجراء حساس يتطلب التحقق بخطوتين' : 'Sensitive: Step-Up MFA Required'}
                </span>
              </div>

              {/* Payment Methods Checkboxes */}
              <div className="space-y-3">
                <span className="block text-small font-semibold text-text">
                  {isAr ? 'طرق الدفع المتاحة للعملاء:' : 'Available Payment Methods:'}
                </span>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.payment_methods_enabled.includes('cod')}
                      onChange={() => handlePaymentMethodToggle('cod')}
                      className="size-4 accent-brand"
                    />
                    <span className="text-body text-text">
                      {isAr ? 'الدفع عند الاستلام (COD)' : 'Cash on Delivery (COD)'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.payment_methods_enabled.includes('instapay_qr')}
                      onChange={() => handlePaymentMethodToggle('instapay_qr')}
                      className="size-4 accent-brand"
                    />
                    <span className="text-body text-text">
                      {isAr ? 'تحويل إنستاباي (InstaPay QR)' : 'InstaPay QR'}
                    </span>
                  </label>
                </div>
              </div>

              <Input
                label={isAr ? 'عنوان حساب إنستاباي (InstaPay IPA / Handle)' : 'InstaPay Handle'}
                value={form.instapay_handle}
                onChange={(e) => handleTextChange('instapay_handle', e.target.value)}
                maxLength={60}
                dir="ltr"
                placeholder="username@instapay"
                hint={
                  isAr
                    ? 'العنوان الذي يظهر للعملاء في صفحة السداد للتحويل المباشر'
                    : 'The address shown to customers for manual transfer'
                }
              />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={savingKey === 'payment'}>
                  {savingKey === 'payment'
                    ? isAr
                      ? 'جارٍ الحفظ...'
                      : 'Saving...'
                    : isAr
                      ? 'حفظ إعدادات الدفع'
                      : 'Save Payment Settings'}
                </Button>
              </div>
            </form>
          </Card>

          {/* QR Image Management Card */}
          <Card className="p-6">
            <div className="space-y-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-h3 font-bold text-text">
                  {isAr ? 'رمز الاستجابة السريعة لإنستاباي (QR Code)' : 'InstaPay QR Code Image'}
                </h3>
                <span className="text-caption rounded-pill bg-warning/10 text-warning px-3 py-1 font-semibold border border-warning/30">
                  {isAr ? 'استبدال الصورة يحذف الملف القديم' : 'Replaces & deletes old file'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative flex size-44 items-center justify-center rounded-card border border-border bg-surface p-2 shadow-card">
                  <img
                    src={getPublicQrUrl(form.instapay_qr_path)}
                    alt={isAr ? 'رمز QR إنستاباي' : 'InstaPay QR'}
                    className="size-full object-contain"
                  />
                </div>

                <div className="space-y-3 text-center sm:text-start">
                  <p className="text-small text-text-muted">
                    {isAr
                      ? 'يجب أن تكون الصورة بصيغة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميجابايت. سيتم إعادة تشفيرها وحذف الصورة القديمة تلقائيًا.'
                      : 'Image must be JPG, PNG, or WebP up to 5 MB. Old file is purged automatically.'}
                  </p>
                  <label htmlFor="instapay-qr-file-input">
                    <input
                      id="instapay-qr-file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleQrFileSelected}
                      disabled={savingKey === 'qr'}
                    />
                    <span className="ui-control ui-button inline-flex cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand px-6 py-2 font-semibold text-brand-contrast">
                      {savingKey === 'qr'
                        ? isAr
                          ? 'جارٍ الرفع والاستبدال...'
                          : 'Uploading...'
                        : isAr
                          ? 'تغيير رمز الاستجابة السريعة (QR)'
                          : 'Replace QR Code'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* SECTION 4: Operational Limits & Policies (Step-Up Guarded) */}
      {activeTab === 'limits' && (
        <Card className="p-6">
          <form onSubmit={saveLimits} className="space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-h3 font-bold text-text">
                {isAr ? 'الحدود التشغيلية والسياسات' : 'Operational Limits & Policies'}
              </h2>
              <span className="text-caption rounded-pill bg-warning/10 text-warning px-3 py-1 font-semibold border border-warning/30">
                {isAr ? 'إجراء حساس يتطلب التحقق بخطوتين' : 'Sensitive: Step-Up MFA Required'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                id="pending_limit_input"
                label={isAr ? 'الحد الأقصى للطلبات المعلقة للعميل' : 'Pending Order Limit'}
                hint={isAr ? 'من 1 حتى 10 طلبات معلقة (الافتراضي: 3)' : 'From 1 to 10 (default 3)'}
              >
                <input
                  id="pending_limit_input"
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={form.pending_order_limit}
                  onChange={(e) =>
                    handleNumberChange('pending_order_limit', Number(e.target.value))
                  }
                  className="ui-control ui-field block w-full rounded-pill border border-border-input bg-surface px-4 py-2 text-text"
                  required
                />
              </Field>

              <Field
                id="payment_window_input"
                label={isAr ? 'مهلة سداد طلبات إنستاباي (بالساعات)' : 'Payment Window (Hours)'}
                hint={isAr ? 'من 1 حتى 72 ساعة (الافتراضي: 24)' : 'From 1 to 72 hours (default 24)'}
              >
                <input
                  id="payment_window_input"
                  type="number"
                  min={1}
                  max={72}
                  step={1}
                  value={form.payment_window_hours}
                  onChange={(e) =>
                    handleNumberChange('payment_window_hours', Number(e.target.value))
                  }
                  className="ui-control ui-field block w-full rounded-pill border border-border-input bg-surface px-4 py-2 text-text"
                  required
                />
              </Field>
            </div>

            <Field
              id="returns_policy_input"
              label={isAr ? 'نص سياسة الاستبدال والاسترجاع' : 'Returns & Exchange Policy Text'}
              hint={
                isAr
                  ? 'يظهر في صفحة السياسات وفي ملخص المتجر (حتى 2000 حرف)'
                  : 'Shown in policies page and storefront footer (up to 2000 chars)'
              }
            >
              <textarea
                id="returns_policy_input"
                rows={5}
                value={form.returns_text_ar}
                onChange={(e) => handleTextChange('returns_text_ar', e.target.value)}
                maxLength={2000}
                className="ui-control ui-field block w-full rounded-card border border-border-input bg-surface p-3 text-text"
                required
              />
            </Field>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={savingKey === 'limits'}>
                {savingKey === 'limits'
                  ? isAr
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : isAr
                    ? 'حفظ الحدود والسياسات'
                    : 'Save Limits & Policies'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* SECTION 5: Recent Audit Log */}
      {activeTab === 'audit' && (
        <Card className="p-6">
          <div className="space-y-6">
            <h2 className="text-h3 font-bold text-text">
              {isAr ? 'سجل تغييرات إعدادات المتجر' : 'Settings Audit Log'}
            </h2>

            {isAuditLoading ? (
              <div className="flex h-32 items-center justify-center text-brand">
                <PearlLoader loading />
              </div>
            ) : auditLogs.length === 0 ? (
              <EmptyState
                title={
                  isAr
                    ? 'لا توجد تغييرات مسجلة في إعدادات المتجر بعد.'
                    : 'No settings audit records found yet.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-small">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="p-3 text-start">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                      <th className="p-3 text-start">{isAr ? 'الإعداد' : 'Setting'}</th>
                      <th className="p-3 text-start">{isAr ? 'القيمة السابقة' : 'Old Value'}</th>
                      <th className="p-3 text-start">{isAr ? 'القيمة الجديدة' : 'New Value'}</th>
                      <th className="p-3 text-start">{isAr ? 'المنفّذ' : 'Actor'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((entry: SettingsAuditEntry) => {
                      const label = SETTING_LABELS[entry.entity_id as SettingKey]
                      const settingName = label ? (isAr ? label.ar : label.en) : entry.entity_id

                      return (
                        <tr key={entry.id} className="hover:bg-surface-tint/50">
                          <td className="p-3 whitespace-nowrap text-text-muted font-mono" dir="ltr">
                            {formatDate(entry.at)}
                          </td>
                          <td className="p-3 font-semibold text-text">{settingName}</td>
                          <td
                            className="p-3 max-w-xs truncate text-text-muted font-mono"
                            title={String(entry.old)}
                          >
                            {renderAuditValue(entry.old)}
                          </td>
                          <td
                            className="p-3 max-w-xs truncate font-mono text-brand font-semibold"
                            title={String(entry.new)}
                          >
                            {renderAuditValue(entry.new)}
                          </td>
                          <td className="p-3 whitespace-nowrap text-text-muted">
                            {entry.actor_role === 'admin'
                              ? isAr
                                ? 'مسؤول المتجر'
                                : 'Admin'
                              : entry.actor_role}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Step-Up Confirmation Dialog */}
      <StepUpDialog
        open={isStepUpOpen}
        onClose={closeStepUp}
        title={
          isAr ? 'تأكيد الهوية (تعديل إعدادات حساسة)' : 'Confirm Identity (Sensitive Settings)'
        }
        description={
          isAr
            ? 'تعديل طرق الدفع أو استبدال رمز QR أو تغيير الحدود التشغيلية يتطلب تأكيد التحقق بخطوتين.'
            : 'Modifying payment methods, replacing QR code, or altering operational limits requires step-up confirmation.'
        }
      />
    </div>
  )
}
