import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { AuthContext } from '@/features/auth/AuthProvider'
import AccountPage from './AccountPage'
import * as accountApi from '@/features/account/api'
import * as deliveryApi from '@/features/delivery/api'
import type { AuthContextValue, UserProfile } from '@/features/auth/types'
import type { CustomerStats } from '@/features/account/types'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { AppError } from '@/lib/errors'

const mockProfile: UserProfile = {
  id: 'user-abc',
  role: 'customer',
  full_name: 'ياسمين محمود',
  phone: '01012345678',
  alt_phone: '01234567890',
  governorate_id: 1,
  city: 'القاهرة',
  district: 'المعادي',
  address: 'شارع 9',
  postal_code: '11728',
  floor: '3',
  apartment: '6',
  landmark: 'بجوار محطة المترو',
}

const mockStats: CustomerStats = {
  orders_count: 4,
  total_spent: 1850,
  favorite_product_id: 101,
  favorite_product_name: 'سلسلة لؤلؤ روز',
}

const mockGovernorates = [
  { id: 1, name_ar: 'القاهرة', name_en: 'Cairo' },
  { id: 2, name_ar: 'الجيزة', name_en: 'Giza' },
]

function renderWithProviders(authOverrides: Partial<AuthContextValue> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const authValue: AuthContextValue = {
    session: null,
    user: { id: 'user-abc', email: 'yasmin@example.com' } as unknown as AuthContextValue['user'],
    profile: mockProfile,
    role: 'customer',
    aal: 'aal1',
    factors: [],
    loading: false,
    loadingFactors: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    resendConfirmation: vi.fn(),
    refreshProfile: vi.fn(),
    refreshAal: vi.fn(),
    refreshFactors: vi.fn(),
    enrollTotp: vi.fn(),
    challengeAndVerify: vi.fn(),
    unenrollFactor: vi.fn(),
    updatePassword: vi.fn(),
    updateEmail: vi.fn(),
    ...authOverrides,
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthContext.Provider value={authValue}>
          <ToastProvider>
            <MemoryRouter initialEntries={['/account']}>
              <Routes>
                <Route path="/account" element={<AccountPage />} />
                <Route path="/account/security" element={<div>Security Page</div>} />
                <Route path="/account/orders" element={<div>Orders Page</div>} />
                <Route path="/product/:id" element={<div>Product Page</div>} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthContext.Provider>
      </LanguageProvider>
    </QueryClientProvider>,
  )
}

describe('AccountPage Integration (T-4.04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(deliveryApi, 'getGovernorates').mockResolvedValue(mockGovernorates)
    vi.spyOn(accountApi, 'getCustomerStatsApi').mockResolvedValue(mockStats)
    vi.spyOn(accountApi, 'updateProfileApi').mockResolvedValue()
  })

  it('renders lifetime stats and favorite product with link', async () => {
    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByText(/1,850/)).toBeInTheDocument()
    })

    expect(screen.getByText('سلسلة لؤلؤ روز')).toBeInTheDocument()
    const favoriteLink = screen.getByRole('link', { name: 'سلسلة لؤلؤ روز' })
    expect(favoriteLink).toHaveAttribute('href', '/product/101')
  })

  it('renders error panel on stats failure with retry option', async () => {
    vi.spyOn(accountApi, 'getCustomerStatsApi').mockRejectedValue(new AppError('SYS-001'))

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByText('حدث خطأ غير متوقع')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument()
  })

  it('pre-fills form fields with user profile information', async () => {
    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByDisplayValue('ياسمين محمود')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('01012345678')).toBeInTheDocument()
    expect(screen.getByDisplayValue('01234567890')).toBeInTheDocument()
    expect(screen.getByDisplayValue('القاهرة')).toBeInTheDocument()
    expect(screen.getByDisplayValue('المعادي')).toBeInTheDocument()
    expect(screen.getByDisplayValue('شارع 9')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    expect(screen.getByDisplayValue('6')).toBeInTheDocument()
    expect(screen.getByDisplayValue('بجوار محطة المترو')).toBeInTheDocument()
  })

  it('validates full name required and Egyptian phone format', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByDisplayValue('ياسمين محمود')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/الاسم بالكامل/i)
    const phoneInput = screen.getByLabelText(/رقم الهاتف الأساسي/i)
    const submitBtn = screen.getByRole('button', { name: /حفظ التغييرات/i })

    // Clear name and enter invalid phone
    await user.clear(nameInput)
    await user.clear(phoneInput)
    await user.type(phoneInput, '12345')
    await user.click(submitBtn)

    expect(await screen.findByText('الاسم مطلوب')).toBeInTheDocument()
    expect(screen.getByText(/رقم هاتف مصري غير صحيح/i)).toBeInTheDocument()
    expect(accountApi.updateProfileApi).not.toHaveBeenCalled()
  })

  it('submits updated profile data without role field and shows success toast', async () => {
    const user = userEvent.setup()
    const refreshProfile = vi.fn().mockResolvedValue(undefined)
    renderWithProviders({ refreshProfile })

    await waitFor(() => {
      expect(screen.getByDisplayValue('ياسمين محمود')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/الاسم بالكامل/i)
    const districtInput = screen.getByLabelText(/الحي \/ المنطقة/i)
    const submitBtn = screen.getByRole('button', { name: /حفظ التغييرات/i })

    await user.clear(nameInput)
    await user.type(nameInput, 'ياسمين حسن محمود')
    await user.clear(districtInput)
    await user.type(districtInput, 'دجلة المعادي')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(accountApi.updateProfileApi).toHaveBeenCalledWith('user-abc', {
        full_name: 'ياسمين حسن محمود',
        phone: '01012345678',
        alt_phone: '01234567890',
        governorate_id: 1,
        city: 'القاهرة',
        district: 'دجلة المعادي',
        address: 'شارع 9',
        postal_code: '11728',
        floor: '3',
        apartment: '6',
        landmark: 'بجوار محطة المترو',
      })
    })

    // HARD SECURITY CONSTRAINT: verify no role in payload
    const updatePayload = vi.mocked(accountApi.updateProfileApi).mock.calls[0][1]
    expect(updatePayload).not.toHaveProperty('role')

    expect(refreshProfile).toHaveBeenCalled()
    expect(await screen.findByText('تم حفظ بيانات الحساب بنجاح')).toBeInTheDocument()
  })

  it('HARD SECURITY: verifies NO role field exists in the DOM or form', async () => {
    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByDisplayValue('ياسمين محمود')).toBeInTheDocument()
    })

    // Verify there is no input or element with name or label 'role' or 'صلاحية'
    expect(screen.queryByLabelText(/role|صلاحية/i)).not.toBeInTheDocument()
    const inputs = screen.getAllByRole('textbox')
    for (const input of inputs) {
      expect(input.getAttribute('name')).not.toBe('role')
      expect(input.getAttribute('id')).not.toBe('role')
    }
  })

  it('renders link to account security', async () => {
    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByDisplayValue('ياسمين محمود')).toBeInTheDocument()
    })

    const securityLinks = screen.getAllByRole('link', { name: /الأمان|انتقل إلى الأمان/i })
    expect(securityLinks.length).toBeGreaterThanOrEqual(1)
    expect(securityLinks[0]).toHaveAttribute('href', '/account/security')
  })
})
