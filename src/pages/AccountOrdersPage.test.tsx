import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { ToastProvider } from '@/components/ui/ToastProvider'
import AccountOrdersPage from './AccountOrdersPage'
import * as ordersApi from '@/features/orders/api'
import type { CustomerOrder } from '@/features/orders/types'
import { AppError } from '@/lib/errors'

const mockOrders: CustomerOrder[] = [
  {
    id: 101,
    user_id: 'user-1',
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:00:00Z',
    status: 'pending',
    payment_status: 'unpaid',
    payment_method: 'cod',
    delivery_method: 'egypt_post',
    tracking_number: 'EG123456789',
    rep_name: null,
    rep_phone: null,
    subtotal: 300,
    shipping_fee: 50,
    total: 350,
    ship_name: 'سارة أحمد',
    ship_phone: '01012345678',
    ship_alt_phone: null,
    ship_governorate: 'القاهرة',
    ship_city: 'مدينة نصر',
    ship_district: 'الحي السابع',
    ship_address: 'شارع الطيران عمارة 15',
    ship_postal_code: '11511',
    ship_floor: '4',
    ship_apartment: '12',
    ship_landmark: 'بجوار مسجد النور',
    notes: null,
    order_items: [
      {
        id: 1,
        order_id: 101,
        product_id: 10,
        product_name: 'Silver Bracelet',
        quantity: 2,
        unit_price: 150,
        products: {
          image_url: 'products/bracelet.webp',
          name: 'Silver Bracelet',
          name_ar: 'سوار فضي أنيق',
        },
      },
    ],
  },
  {
    id: 102,
    user_id: 'user-1',
    created_at: '2026-10-09T10:00:00Z',
    updated_at: '2026-10-09T10:00:00Z',
    status: 'pending',
    payment_status: 'under_review',
    payment_method: 'instapay_qr',
    delivery_method: 'representative',
    tracking_number: null,
    rep_name: 'محمد مندوب',
    rep_phone: '01123456789',
    subtotal: 500,
    shipping_fee: 40,
    total: 540,
    ship_name: 'سارة أحمد',
    ship_phone: '01012345678',
    ship_alt_phone: null,
    ship_governorate: 'الجيزة',
    ship_city: 'الدقي',
    ship_district: 'ميدان المساحة',
    ship_address: 'شارع مصدق',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    order_items: [
      {
        id: 2,
        order_id: 102,
        product_id: 20,
        product_name: 'Ceramic Mug',
        quantity: 1,
        unit_price: 500,
        products: {
          image_url: 'products/mug.webp',
          name: 'Ceramic Mug',
          name_ar: 'كوب سيراميك يدوي',
        },
      },
    ],
  },
  {
    id: 103,
    user_id: 'user-1',
    created_at: '2026-10-08T08:00:00Z',
    updated_at: '2026-10-08T08:00:00Z',
    status: 'shipped',
    payment_status: 'paid',
    payment_method: 'cod',
    delivery_method: 'representative',
    tracking_number: null,
    rep_name: 'محمود السيد',
    rep_phone: '01234567890',
    subtotal: 200,
    shipping_fee: 40,
    total: 240,
    ship_name: 'سارة أحمد',
    ship_phone: '01012345678',
    ship_alt_phone: null,
    ship_governorate: 'الجيزة',
    ship_city: 'الدقي',
    ship_district: null,
    ship_address: 'شارع التحرير',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    order_items: [
      {
        id: 3,
        order_id: 103,
        product_id: 30,
        product_name: 'Earrings',
        quantity: 1,
        unit_price: 200,
        products: {
          image_url: null,
          name: 'Earrings',
          name_ar: 'أقراط لؤلؤ',
        },
      },
    ],
  },
]

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLanguage="ar">
        <ToastProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ToastProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  )
}

describe('AccountOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
    })
  })

  it('renders loading state initially', () => {
    vi.spyOn(ordersApi, 'getMyOrdersApi').mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<AccountOrdersPage />)

    expect(screen.getByRole('status', { name: 'جارٍ تحميل الطلبات' })).toBeInTheDocument()
  })

  it('renders error panel on query failure and allows retry', async () => {
    const errorSpy = vi
      .spyOn(ordersApi, 'getMyOrdersApi')
      .mockRejectedValue(new AppError('SYS-001'))
    const user = userEvent.setup()

    renderWithProviders(<AccountOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText(/SYS-001/)).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/i })
    expect(retryBtn).toBeInTheDocument()

    errorSpy.mockResolvedValueOnce(mockOrders)
    await user.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
    })
  })

  it('renders empty state when customer has no orders', async () => {
    vi.spyOn(ordersApi, 'getMyOrdersApi').mockResolvedValue([])
    renderWithProviders(<AccountOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('لا توجد طلبات سابقة حتى الآن')).toBeInTheDocument()
    })

    const shopBtn = screen.getByRole('link', { name: 'تسوّق الآن' })
    expect(shopBtn).toHaveAttribute('href', '/category/all')
  })

  it('renders orders list with statuses, delivery info, and items', async () => {
    vi.spyOn(ordersApi, 'getMyOrdersApi').mockResolvedValue(mockOrders)
    renderWithProviders(<AccountOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
      expect(screen.getByText('#102')).toBeInTheDocument()
      expect(screen.getByText('#103')).toBeInTheDocument()
    })

    // Postal tracking number displayed
    expect(screen.getByText('EG123456789')).toBeInTheDocument()

    // Postal code displayed
    expect(screen.getByText('11511')).toBeInTheDocument()

    // Representative info displayed
    expect(screen.getByText('محمد مندوب')).toBeInTheDocument()
    expect(screen.getByText('01123456789')).toBeInTheDocument()

    // Products displayed
    expect(screen.getByText('سوار فضي أنيق')).toBeInTheDocument()
    expect(screen.getByText('كوب سيراميك يدوي')).toBeInTheDocument()
    expect(screen.getByText('أقراط لؤلؤ')).toBeInTheDocument()
  })

  it('cancel button is visible ONLY on eligible pending orders (not under review or shipped)', async () => {
    vi.spyOn(ordersApi, 'getMyOrdersApi').mockResolvedValue(mockOrders)
    renderWithProviders(<AccountOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
    })

    // Order 101 is pending + unpaid -> CANCEL BUTTON MUST EXIST
    // Order 102 is pending + under_review -> CANCEL BUTTON MUST NOT EXIST
    // Order 103 is shipped + paid -> CANCEL BUTTON MUST NOT EXIST
    const cancelButtons = screen.getAllByRole('button', { name: 'إلغاء الطلب' })
    expect(cancelButtons).toHaveLength(1)

    // For Order 102 under review, informational badge is shown
    expect(screen.getByText('إيصال التحويل قيد مراجعة الإدارة')).toBeInTheDocument()
  })

  it('cancelling an eligible order opens modal and calls cancelMyOrderApi on confirmation', async () => {
    vi.spyOn(ordersApi, 'getMyOrdersApi').mockResolvedValue(mockOrders)
    const cancelSpy = vi.spyOn(ordersApi, 'cancelMyOrderApi').mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithProviders(<AccountOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
    })

    const cancelBtn = screen.getByRole('button', { name: 'إلغاء الطلب' })
    await user.click(cancelBtn)

    // Confirmation dialog opens
    expect(screen.getByText('تأكيد إلغاء الطلب')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('طلب رقم #101')

    // Click confirm cancel inside modal
    const confirmBtn = screen.getByRole('button', { name: 'تأكيد الإلغاء' })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(101)
      expect(screen.getByText('تم إلغاء الطلب بنجاح')).toBeInTheDocument()
    })
  })

  it('dismissing cancellation dialog does not call cancelMyOrderApi', async () => {
    vi.spyOn(ordersApi, 'getMyOrdersApi').mockResolvedValue(mockOrders)
    const cancelSpy = vi.spyOn(ordersApi, 'cancelMyOrderApi')
    const user = userEvent.setup()

    renderWithProviders(<AccountOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
    })

    const cancelBtn = screen.getByRole('button', { name: 'إلغاء الطلب' })
    await user.click(cancelBtn)

    // Modal is open
    expect(screen.getByText('تأكيد إلغاء الطلب')).toBeInTheDocument()

    // Click dismiss / cancel
    const backBtn = screen.getByRole('button', { name: 'تراجع' })
    await user.click(backBtn)

    expect(cancelSpy).not.toHaveBeenCalled()
  })
})
