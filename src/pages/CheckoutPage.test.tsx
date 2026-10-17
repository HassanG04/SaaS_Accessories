import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { CartContext } from '@/features/cart'
import { AuthContext } from '@/features/auth/AuthProvider'
import CheckoutPage from './CheckoutPage'
import * as checkoutApi from '@/features/checkout/api'
import * as deliveryApi from '@/features/delivery/api'
import * as settingsApi from '@/features/settings/api'
import type { CartContextValue, CartLine } from '@/features/cart/types'
import type { AuthContextValue, UserProfile } from '@/features/auth/types'
import type { DeliveryFeeOption, Governorate } from '@/features/delivery/types'
import { AppError } from '@/lib/errors'

const mockCartItems: CartLine[] = [
  {
    productId: 101,
    quantity: 2,
    unitPrice: 150,
    originalPrice: null,
    hasDiscount: false,
    discountPercent: 0,
    lineTotal: 300,
    isOutOfStock: false,
    maxStock: 10,
    isStale: false,
    product: {
      id: 101,
      category_id: 1,
      name: 'Silver Ring',
      name_ar: 'خاتم فضة',
      description: null,
      description_ar: null,
      price: 150,
      discount_percent: 0,
      final_price: 150,
      stock_quantity: 10,
      in_stock: true,
      sold_count: 5,
      is_active: true,
      is_featured: false,
      image_url: 'products/product-ring.webp',
      extra_images: [],
      created_at: '2026-10-10T00:00:00Z',
      updated_at: '2026-10-10T00:00:00Z',
    },
  },
]

const mockGovernorates: Governorate[] = [
  { id: 1, name_ar: 'القاهرة', name_en: 'Cairo' },
  { id: 2, name_ar: 'الجيزة', name_en: 'Giza' },
]

const mockDeliveryFees: DeliveryFeeOption[] = [
  {
    governorate_id: 1,
    method: 'representative',
    fee: 45,
    label_ar: 'مندوب توصيل',
    label_en: 'Courier',
  },
  {
    governorate_id: 1,
    method: 'egypt_post',
    fee: 30,
    label_ar: 'البريد المصري',
    label_en: 'Egypt Post',
  },
]

const mockProfile: UserProfile = {
  id: 'usr-123',
  role: 'customer',
  full_name: 'أحمد محمود',
  phone: '01012345678',
  alt_phone: '01123456789',
  governorate_id: 1,
  city: 'مدينة نصر',
  district: 'المنطقة الأولى',
  address: '12 شارع الطيران',
  postal_code: '11511',
  floor: '4',
  apartment: '8',
  landmark: 'أمام حديقة الطفل',
}

function LocationWatcher() {
  const location = useLocation()
  return <div data-testid="current-location">{location.pathname}</div>
}

function renderCheckoutPage(options?: {
  cartItems?: CartLine[]
  clearCart?: () => void
  profile?: UserProfile | null
  user?: AuthContextValue['user']
  lang?: 'ar' | 'en'
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  const lines = options?.cartItems ?? mockCartItems
  const cartValue: CartContextValue = {
    items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    lines,
    totalCount: lines.reduce((acc, l) => acc + l.quantity, 0),
    itemCount: lines.length,
    subtotal: lines.reduce((acc, l) => acc + l.lineTotal, 0),
    isLoading: false,
    isDrawerOpen: false,
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
    toggleDrawer: vi.fn(),
    addItem: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearCart: options?.clearCart ?? vi.fn(),
  }

  const authValue: AuthContextValue = {
    session: null,
    user:
      options?.user !== undefined
        ? options.user
        : ({
            id: 'usr-123',
            email: 'test@example.com',
            email_confirmed_at: '2026-10-10T00:00:00Z',
          } as unknown as AuthContextValue['user']),
    profile: options?.profile !== undefined ? options.profile : mockProfile,
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
  }

  return render(
    <LanguageProvider initialLanguage={options?.lang ?? 'ar'}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue}>
          <CartContext.Provider value={cartValue}>
            <MemoryRouter initialEntries={['/checkout']}>
              <LocationWatcher />
              <Routes>
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order/:id/thanks" element={<div>Thanks Page</div>} />
                <Route path="/pay/:orderId" element={<div>Pay Page</div>} />
              </Routes>
            </MemoryRouter>
          </CartContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </LanguageProvider>,
  )
}

describe('CheckoutPage (T-4.02)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()

    vi.spyOn(deliveryApi, 'getGovernorates').mockResolvedValue(mockGovernorates)
    vi.spyOn(deliveryApi, 'getDeliveryFees').mockResolvedValue(mockDeliveryFees)
    vi.spyOn(settingsApi, 'getPublicSettings').mockResolvedValue({
      payment_methods_enabled: ['cod', 'instapay_qr'],
    })
  })

  it('renders empty cart state when cart has no items', () => {
    renderCheckoutPage({ cartItems: [] })

    expect(screen.getByText('سلة التسوق فارغة')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'تصفّح المنتجات' })).toBeInTheDocument()
  })

  it('pre-fills location details from profile', async () => {
    renderCheckoutPage()

    await waitFor(() => {
      expect(screen.getByDisplayValue('أحمد محمود')).toBeInTheDocument()
      expect(screen.getByDisplayValue('01012345678')).toBeInTheDocument()
      expect(screen.getByDisplayValue('01123456789')).toBeInTheDocument()
      expect(screen.getByDisplayValue('12 شارع الطيران')).toBeInTheDocument()
      expect(screen.getByDisplayValue('مدينة نصر')).toBeInTheDocument()
      expect(screen.getByDisplayValue('11511')).toBeInTheDocument()
    })
  })

  it('renders delivery methods and updates total with fee', async () => {
    renderCheckoutPage()

    await waitFor(() => {
      expect(screen.getByText('مندوب توصيل')).toBeInTheDocument()
      expect(screen.getByText('البريد المصري')).toBeInTheDocument()
    })

    // Subtotal 300 + default first fee 45 = 345
    expect(screen.getByText(/345/)).toBeInTheDocument()
  })

  it('submits COD order and navigates to thanks page', async () => {
    const user = userEvent.setup()
    const clearCartMock = vi.fn()
    const placeOrderMock = vi.spyOn(checkoutApi, 'placeOrderApi').mockResolvedValue(9901)

    renderCheckoutPage({ clearCart: clearCartMock })

    await waitFor(() => {
      expect(screen.getByText('مندوب توصيل')).toBeInTheDocument()
    })

    // Click confirm order
    const submitBtn = screen.getByRole('button', { name: 'تأكيد الطلب' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(placeOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          delivery_method: 'representative',
          payment_method: 'cod',
          items: [{ product_id: 101, quantity: 2 }],
          ship: expect.objectContaining({
            name: 'أحمد محمود',
            phone: '01012345678',
            governorate_id: 1,
            address: '12 شارع الطيران',
            postal_code: '11511',
          }),
        }),
      )
      expect(clearCartMock).toHaveBeenCalled()
      expect(screen.getByTestId('current-location')).toHaveTextContent('/order/9901/thanks')
    })
  })

  it('submits InstaPay QR order and navigates to /pay/:orderId', async () => {
    const user = userEvent.setup()
    const clearCartMock = vi.fn()
    const placeOrderMock = vi.spyOn(checkoutApi, 'placeOrderApi').mockResolvedValue(9902)

    renderCheckoutPage({ clearCart: clearCartMock })

    await waitFor(() => {
      expect(screen.getByText('الدفع عبر إنستاباي (QR)')).toBeInTheDocument()
    })

    // Select InstaPay
    const instapayCard = screen.getByRole('radio', { name: /الدفع عبر إنستاباي/ })
    await user.click(instapayCard)

    // When InstaPay with approval is active, button text is "إرسال الطلب" and note is shown
    expect(screen.getByText(/سنراجع طلبك أولًا/)).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: 'إرسال الطلب' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(placeOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: 'instapay_qr',
          save_address: true,
        }),
      )
      expect(clearCartMock).toHaveBeenCalled()
      expect(screen.getByTestId('current-location')).toHaveTextContent('/pay/9902')
    })
  })

  it('renders ErrorPanel when placeOrderApi throws an AppError', async () => {
    const user = userEvent.setup()
    vi.spyOn(checkoutApi, 'placeOrderApi').mockRejectedValue(
      new AppError('ORD-007', { params: { name: 'خاتم فضة', left: 1 } }),
    )

    renderCheckoutPage()

    await waitFor(() => {
      expect(screen.getByText('مندوب توصيل')).toBeInTheDocument()
    })

    const submitBtn = screen.getByRole('button', { name: 'تأكيد الطلب' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getAllByRole('alert')[0]).toBeInTheDocument()
      expect(screen.getByText(/المتبقي/)).toBeInTheDocument()
    })
  })

  it('passes save_address: false when user unticks the save address checkbox', async () => {
    const user = userEvent.setup()
    const placeOrderMock = vi.spyOn(checkoutApi, 'placeOrderApi').mockResolvedValue(9903)

    renderCheckoutPage()

    await waitFor(() => {
      expect(screen.getByText('الدفع نقدًا عند الاستلام')).toBeInTheDocument()
    })

    const saveAddressCheckbox = screen.getByRole('checkbox', {
      name: /احفظ هذا العنوان لطلباتي القادمة/i,
    })
    expect(saveAddressCheckbox).toBeChecked()
    await user.click(saveAddressCheckbox)
    expect(saveAddressCheckbox).not.toBeChecked()

    const submitBtn = screen.getByRole('button', { name: 'تأكيد الطلب' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(placeOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          save_address: false,
        }),
      )
    })
  })

  it('blocks order placement and shows verification banner when email is not confirmed', async () => {
    const unconfirmedUser = {
      id: 'usr-unconfirmed',
      email: 'unconfirmed@example.com',
      email_confirmed_at: null,
    } as unknown as AuthContextValue['user']

    renderCheckoutPage({ user: unconfirmedUser })

    await waitFor(() => {
      expect(screen.getByText('تحقق من بريدك الإلكتروني')).toBeInTheDocument()
    })

    const submitBtn = screen.getByRole('button', {
      name: /يرجى تأكيد بريدك الإلكتروني لتتمكن من إتمام الطلب/i,
    })
    expect(submitBtn).toBeDisabled()
  })

  it('renders checkout page completely in English without Arabic leak', async () => {
    renderCheckoutPage({ lang: 'en' })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delivery Information' })).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Recipient Information' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Delivery Address' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Delivery Method' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Payment Method' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Order summary (estimated)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm Order' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Cart' })).toBeInTheDocument()

    // Assert absence of Arabic text
    expect(screen.queryByText('معلومات المستلم')).not.toBeInTheDocument()
    expect(screen.queryByText('عنوان التوصيل')).not.toBeInTheDocument()
    expect(screen.queryByText('العودة إلى السلة')).not.toBeInTheDocument()
  })
})
