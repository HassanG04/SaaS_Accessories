import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { supabase } from '@/lib/supabase'
import { AppError } from '@/lib/errors'
import SettingsPage from './SettingsPage'
import {
  validateSettingValue,
  validateSalePercent,
  validatePaymentMethods,
  validateInstagram,
  validatePendingOrderLimit,
  validatePaymentWindowHours,
  validateInstaPayQrPath,
  validateShopName,
  isAllowedSettingKey,
} from './validators'
import {
  getAdminSettings,
  updateAdminSetting,
  uploadInstaPayQrImage,
  getPublicQrUrl,
  getRecentSettingsAudit,
  DEFAULT_SETTINGS,
} from './api'

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    rpc: vi.fn(),
  },
  getSupabase: vi.fn(() => ({
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    rpc: vi.fn(),
  })),
}))

// Mock useStepUp & StepUpDialog
const mockOpenStepUp = vi.fn()
const mockCloseStepUp = vi.fn()
let mockIsConfirmed = false

vi.mock('@/features/auth/useStepUp', () => ({
  useStepUp: () => ({
    isConfirmed: mockIsConfirmed,
    openStepUp: mockOpenStepUp.mockImplementation((action?: () => void) => {
      if (mockIsConfirmed && action) action()
    }),
    dialogOpen: false,
    closeStepUp: mockCloseStepUp,
    confirmStepUp: vi.fn().mockResolvedValue({ success: true }),
    submitting: false,
    errorCode: null,
    factorId: 'factor-1',
  }),
}))

vi.mock('@/features/auth/StepUpDialog', () => ({
  StepUpDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mock-step-up-dialog">Mock StepUp Dialog</div> : null,
}))

// Mock image upload helpers
vi.mock('../products/imageUpload', () => ({
  validateProductImageFile: vi.fn().mockImplementation(async (file: File | Blob) => {
    if (file.size > 5 * 1024 * 1024) throw new AppError('UPL-002')
    return { mimeType: 'image/png', extension: 'png' }
  }),
  resizeAndEncodeImage: vi.fn().mockImplementation(async () => {
    return {
      blob: new Blob(['fake-image-bytes'], { type: 'image/png' }),
      extension: 'png',
      contentType: 'image/png',
    }
  }),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function renderSettingsPage() {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  )
}

describe('T-5.09: Admin site settings validators', () => {
  it('identifies allow-listed and unknown setting keys', () => {
    expect(isAllowedSettingKey('shop_name_ar')).toBe(true)
    expect(isAllowedSettingKey('sale_percent')).toBe(true)
    expect(isAllowedSettingKey('payment_methods_enabled')).toBe(true)
    expect(isAllowedSettingKey('pending_order_limit')).toBe(true)
    expect(isAllowedSettingKey('unknown_key')).toBe(false)
    expect(isAllowedSettingKey('hacked_setting')).toBe(false)
  })

  it('rejects unknown setting keys with ADM-008', () => {
    const res = validateSettingValue('unauthorized_key', 'value')
    expect(res.valid).toBe(false)
    expect(res.errorHint).toBe('ADM-008')
  })

  it('validates sale_percent (0..90 integer)', () => {
    expect(validateSalePercent(0)).toBe(true)
    expect(validateSalePercent(50)).toBe(true)
    expect(validateSalePercent(90)).toBe(true)

    expect(validateSalePercent(-1)).toBe(false)
    expect(validateSalePercent(91)).toBe(false)
    expect(validateSalePercent(45.5)).toBe(false)
    expect(validateSalePercent('50' as unknown as number)).toBe(false)

    expect(validateSettingValue('sale_percent', 100)).toEqual({
      valid: false,
      errorHint: 'ADM-007',
    })
    expect(validateSettingValue('sale_percent', 30)).toEqual({ valid: true })
  })

  it('validates payment_methods_enabled (array of cod and instapay_qr, length 1..2)', () => {
    expect(validatePaymentMethods(['cod'])).toBe(true)
    expect(validatePaymentMethods(['cod', 'instapay_qr'])).toBe(true)
    expect(validatePaymentMethods(['instapay_qr'])).toBe(true)

    expect(validatePaymentMethods([])).toBe(false)
    expect(validatePaymentMethods(['credit_card'])).toBe(false)
    expect(validatePaymentMethods(['cod', 'instapay_qr', 'wallet'])).toBe(false)
    expect(validateSettingValue('payment_methods_enabled', [])).toEqual({
      valid: false,
      errorHint: 'ADM-007',
    })
  })

  it('validates instagram url (empty or https URL <= 100 chars)', () => {
    expect(validateInstagram('')).toBe(true)
    expect(validateInstagram('https://instagram.com/lolys.eg')).toBe(true)
    expect(validateInstagram('http://insecure.com')).toBe(false)
    expect(validateInstagram('not-a-url')).toBe(false)
    expect(validateSettingValue('instagram', 'invalid-url')).toEqual({
      valid: false,
      errorHint: 'ADM-007',
    })
  })

  it('validates operational limits (pending_order_limit: 1..10, payment_window_hours: 1..72)', () => {
    expect(validatePendingOrderLimit(1)).toBe(true)
    expect(validatePendingOrderLimit(3)).toBe(true)
    expect(validatePendingOrderLimit(10)).toBe(true)
    expect(validatePendingOrderLimit(0)).toBe(false)
    expect(validatePendingOrderLimit(11)).toBe(false)

    expect(validatePaymentWindowHours(1)).toBe(true)
    expect(validatePaymentWindowHours(24)).toBe(true)
    expect(validatePaymentWindowHours(72)).toBe(true)
    expect(validatePaymentWindowHours(0)).toBe(false)
    expect(validatePaymentWindowHours(73)).toBe(false)
  })

  it('validates instapay_qr_path format', () => {
    expect(validateInstaPayQrPath('')).toBe(true)
    expect(validateInstaPayQrPath('settings/qr-123.png')).toBe(true)
    expect(validateInstaPayQrPath('settings/instapay-qr-default.png')).toBe(true)
    expect(validateInstaPayQrPath('products/img.jpg')).toBe(false)
    expect(validateInstaPayQrPath('malicious/path.exe')).toBe(false)
  })

  it('validates shop_name length constraints (1..60)', () => {
    expect(validateShopName("Lolys'")).toBe(true)
    expect(validateShopName('')).toBe(false)
    expect(validateShopName('   ')).toBe(false)
    expect(validateShopName('A'.repeat(61))).toBe(false)
  })
})

describe('T-5.09: Admin site settings API layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getAdminSettings fetches shop_settings and falls back to defaults for missing keys', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { key: 'shop_name_ar', value: 'متجر لوليز التجريبي' },
          { key: 'sale_percent', value: 70 },
        ],
        error: null,
      }),
    } as unknown as ReturnType<typeof supabase.from>)

    const settings = await getAdminSettings()
    expect(settings.shop_name_ar).toBe('متجر لوليز التجريبي')
    expect(settings.sale_percent).toBe(70)
    // Fallback default
    expect(settings.pending_order_limit).toBe(3)
  })

  it('updateAdminSetting throws ADM-008 on unknown key before making network call', async () => {
    const rpcSpy = vi.mocked(supabase.rpc)
    await expect(
      updateAdminSetting('hacked_key' as unknown as 'sale_percent', 50),
    ).rejects.toThrow()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('updateAdminSetting throws ADM-007 on invalid value', async () => {
    const rpcSpy = vi.mocked(supabase.rpc)
    await expect(updateAdminSetting('sale_percent', 999)).rejects.toThrow()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('updateAdminSetting calls admin_update_setting RPC on valid setting', async () => {
    const rpcSpy = vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    await updateAdminSetting('sale_percent', 35)

    expect(rpcSpy).toHaveBeenCalledWith('admin_update_setting', {
      p_key: 'sale_percent',
      p_value: 35,
    })
  })

  it('uploadInstaPayQrImage uploads file, updates setting, and removes old custom QR', async () => {
    const uploadSpy = vi.fn().mockResolvedValue({ error: null })
    const removeSpy = vi.fn().mockResolvedValue({ error: null })

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: uploadSpy,
      remove: removeSpy,
    } as unknown as ReturnType<typeof supabase.storage.from>)

    const rpcSpy = vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    const fakeFile = new File(['fake-png-content'], 'qr.png', { type: 'image/png' })
    const oldCustomPath = 'settings/instapay-qr-old-uuid.png'

    const newPath = await uploadInstaPayQrImage(fakeFile, oldCustomPath)

    expect(uploadSpy).toHaveBeenCalled()
    expect(rpcSpy).toHaveBeenCalledWith('admin_update_setting', {
      p_key: 'instapay_qr_path',
      p_value: newPath,
    })
    // Verified: old custom QR file is removed from storage
    expect(removeSpy).toHaveBeenCalledWith([oldCustomPath])
  })

  it('uploadInstaPayQrImage does not remove default placeholder image', async () => {
    const uploadSpy = vi.fn().mockResolvedValue({ error: null })
    const removeSpy = vi.fn().mockResolvedValue({ error: null })

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: uploadSpy,
      remove: removeSpy,
    } as unknown as ReturnType<typeof supabase.storage.from>)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    const fakeFile = new File(['fake-png'], 'qr.png', { type: 'image/png' })
    await uploadInstaPayQrImage(fakeFile, 'settings/instapay-qr-default.png')

    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('getPublicQrUrl falls back to placeholder SVG when empty or default', () => {
    expect(getPublicQrUrl(null)).toBe('/placeholders/instapay-qr.svg')
    expect(getPublicQrUrl('')).toBe('/placeholders/instapay-qr.svg')
    expect(getPublicQrUrl('settings/instapay-qr-default.png')).toBe('/placeholders/instapay-qr.svg')

    vi.mocked(supabase.storage.from).mockReturnValue({
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://storage.lolys.eg/settings/instapay-qr-123.png' },
      }),
    } as unknown as ReturnType<typeof supabase.storage.from>)

    expect(getPublicQrUrl('settings/instapay-qr-123.png')).toBe(
      'https://storage.lolys.eg/settings/instapay-qr-123.png',
    )
  })

  it('getRecentSettingsAudit queries audit_log for entity shop_settings', async () => {
    const mockAudit = [
      {
        id: 1,
        at: '2026-10-14T01:00:00Z',
        actor: 'user-1',
        actor_role: 'admin',
        action: 'UPDATE',
        entity: 'shop_settings',
        entity_id: 'sale_percent',
        old: { value: 50 },
        new: { value: 60 },
      },
    ]

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockAudit,
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>)

    const result = await getRecentSettingsAudit()
    expect(result).toHaveLength(1)
    expect(result[0].entity_id).toBe('sale_percent')
  })
})

describe('T-5.09: Admin Settings UI and step-up authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockIsConfirmed = false
    mockOpenStepUp.mockClear()
    mockCloseStepUp.mockClear()

    // Default mock for shop_settings query
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shop_settings') {
        return {
          select: vi.fn().mockResolvedValue({
            data: Object.entries(DEFAULT_SETTINGS).map(([k, v]) => ({
              key: k,
              value: v,
              is_public: true,
              updated_at: '2026-10-14T00:00:00Z',
              updated_by: null,
            })),
            error: null,
          }),
        } as unknown as ReturnType<typeof supabase.from>
      }
      if (table === 'audit_log') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 10,
                      at: '2026-10-14T01:00:00Z',
                      actor: 'admin-1',
                      actor_role: 'admin',
                      action: 'UPDATE',
                      entity: 'shop_settings',
                      entity_id: 'sale_percent',
                      old: { value: 50 },
                      new: { value: 65 },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof supabase.from>
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders settings page with all sections and tabs', async () => {
    renderSettingsPage()

    expect(await screen.findByRole('heading', { name: 'إعدادات المتجر' })).toBeInTheDocument()

    // Tab buttons
    expect(screen.getByRole('button', { name: 'معلومات المتجر والتواصل' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'الواجهة والخصم والإعلانات' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'طرق الدفع وإنستاباي' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'الحدود التشغيلية والسياسات' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'سجل التغييرات' })).toBeInTheDocument()

    // Form field in active tab
    expect(screen.getByLabelText('اسم المتجر (بالعربية)')).toHaveValue(
      DEFAULT_SETTINGS.shop_name_ar,
    )
  })

  it('updates storefront hero and sale percentage with live preview', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByRole('heading', { name: 'إعدادات المتجر' })

    // Switch to hero tab
    const heroTab = screen.getByRole('button', { name: 'الواجهة والخصم والإعلانات' })
    await user.click(heroTab)

    expect(screen.getByLabelText('عنوان الواجهة الرئيسية (Hero Title)')).toBeInTheDocument()
    const saleInput = screen.getByLabelText('نسبة الخصم العامة (%)')
    expect(saleInput).toHaveValue(50)

    // Check live preview badge
    expect(screen.getByText('خصم يصل إلى 50%')).toBeInTheDocument()

    // Change sale percent
    await user.clear(saleInput)
    await user.type(saleInput, '65')

    // Live preview badge updates immediately
    expect(screen.getByText('خصم يصل إلى 65%')).toBeInTheDocument()
  })

  it('prompts step-up verification before saving payment methods if not confirmed', async () => {
    const user = userEvent.setup()
    mockIsConfirmed = false

    renderSettingsPage()
    await screen.findByRole('heading', { name: 'إعدادات المتجر' })

    // Switch to payment tab
    await user.click(screen.getByRole('button', { name: 'طرق الدفع وإنستاباي' }))

    const savePaymentBtn = screen.getByRole('button', { name: 'حفظ إعدادات الدفع' })
    await user.click(savePaymentBtn)

    // Step-up is requested
    expect(mockOpenStepUp).toHaveBeenCalled()
  })

  it('prompts step-up verification before saving operational limits if not confirmed', async () => {
    const user = userEvent.setup()
    mockIsConfirmed = false

    renderSettingsPage()
    await screen.findByRole('heading', { name: 'إعدادات المتجر' })

    // Switch to limits tab
    await user.click(screen.getByRole('button', { name: 'الحدود التشغيلية والسياسات' }))

    const saveLimitsBtn = screen.getByRole('button', { name: 'حفظ الحدود والسياسات' })
    await user.click(saveLimitsBtn)

    // Step-up is requested
    expect(mockOpenStepUp).toHaveBeenCalled()
  })

  it('prompts step-up verification when uploading a new QR image', async () => {
    mockIsConfirmed = false

    renderSettingsPage()
    await screen.findByRole('heading', { name: 'إعدادات المتجر' })

    // Switch to payment tab
    fireEvent.click(screen.getByRole('button', { name: 'طرق الدفع وإنستاباي' }))

    const fileInput = document.getElementById('instapay-qr-file-input') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    const fakeFile = new File(['dummy-bytes'], 'new-qr.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })

    // Step-up is requested for QR file upload
    expect(mockOpenStepUp).toHaveBeenCalled()
  })

  it('displays audit log tab with friendly translated labels and previous/new values', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await screen.findByRole('heading', { name: 'إعدادات المتجر' })

    // Switch to audit tab
    await user.click(screen.getByRole('button', { name: 'سجل التغييرات' }))

    expect(await screen.findByText('سجل تغييرات إعدادات المتجر')).toBeInTheDocument()
    // Translated friendly label
    expect(screen.getByText('نسبة الخصم العامة (%)')).toBeInTheDocument()
    // Old and new values
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('65')).toBeInTheDocument()
    expect(screen.getByText('مسؤول المتجر')).toBeInTheDocument()
  })
})
