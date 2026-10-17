import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { ToastProvider } from '@/components/ui/ToastProvider'
import {
  getAllowedTransitions,
  isTransitionAllowed,
  ORDER_STATUS_LABELS,
  formatEgyptianPhoneForWhatsApp,
  getOrderWhatsAppApprovalUrl,
} from './transitions'
import * as api from './api'
import OrdersPage from './OrdersPage'
import { getSupabase } from '@/lib/supabase'
import { AppError } from '@/lib/errors'
import type { AdminOrder } from './types'

const mockOrders: AdminOrder[] = [
  {
    id: 101,
    user_id: 'user-1',
    created_at: '2026-10-12T10:00:00Z',
    updated_at: '2026-10-12T10:00:00Z',
    status: 'pending',
    payment_status: 'unpaid',
    payment_method: 'cod',
    delivery_method: 'egypt_post',
    subtotal: 350,
    shipping_fee: 50,
    total: 400,
    ship_name: 'سارة أحمد',
    ship_phone: '01012345678',
    ship_alt_phone: '01198765432',
    ship_governorate: 'القاهرة',
    ship_city: 'مدينة نصر',
    ship_district: 'الحي السابع',
    ship_address: 'شارع عباس العقاد عمارة 10',
    ship_postal_code: '11511',
    ship_floor: '3',
    ship_apartment: '12',
    ship_landmark: 'بجوار صيدلية العزبي',
    notes: 'يرجى الاتصال قبل الوصول',
    tracking_number: null,
    rep_name: null,
    rep_phone: null,
    payment_reference: null,
    payment_proof_path: null,
    payment_deadline: null,
    payment_submitted_at: null,
    paid_at: null,
    payment_review_note: null,
    order_items: [
      {
        id: 1,
        order_id: 101,
        product_id: 10,
        product_name: 'سوار ذهبي كلاسيكي',
        quantity: 2,
        unit_price: 175,
        products: {
          image_url: 'https://example.com/bracelet.jpg',
          name: 'Classic Gold Bracelet',
          name_ar: 'سوار ذهبي كلاسيكي',
        },
      },
    ],
  },
  {
    id: 102,
    user_id: 'user-2',
    created_at: '2026-10-11T14:30:00Z',
    updated_at: '2026-10-11T14:30:00Z',
    status: 'confirmed',
    payment_status: 'paid',
    payment_method: 'instapay_qr',
    delivery_method: 'representative',
    subtotal: 500,
    shipping_fee: 40,
    total: 540,
    ship_name: 'محمود حسن',
    ship_phone: '01234567890',
    ship_alt_phone: null,
    ship_governorate: 'الجيزة',
    ship_city: 'الدقي',
    ship_district: 'ميدان المساحة',
    ship_address: '5 شارع مصدق',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: null,
    rep_name: 'كابتن علي',
    rep_phone: '01000000000',
    payment_reference: 'IP-998877',
    payment_proof_path: 'proofs/102.jpg',
    payment_deadline: null,
    payment_submitted_at: '2026-10-11T15:00:00Z',
    paid_at: '2026-10-11T16:00:00Z',
    payment_review_note: 'Verified with bank SMS',
    order_items: [
      {
        id: 2,
        order_id: 102,
        product_id: 15,
        product_name: 'أقراط لؤلؤ روز',
        quantity: 1,
        unit_price: 500,
        products: {
          image_url: 'https://example.com/earrings.jpg',
          name: 'Rose Pearl Earrings',
          name_ar: 'أقراط لؤلؤ روز',
        },
      },
    ],
  },
  {
    id: 103,
    user_id: 'user-3',
    created_at: '2026-10-10T09:15:00Z',
    updated_at: '2026-10-10T12:00:00Z',
    status: 'shipped',
    payment_status: 'paid',
    payment_method: 'instapay_qr',
    delivery_method: 'egypt_post',
    subtotal: 200,
    shipping_fee: 45,
    total: 245,
    ship_name: 'نوران يوسف',
    ship_phone: '01511223344',
    ship_alt_phone: null,
    ship_governorate: 'الإسكندرية',
    ship_city: 'سموحة',
    ship_district: null,
    ship_address: 'طريق 14 مايو',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: 'EG123456789',
    rep_name: null,
    rep_phone: null,
    payment_reference: 'IP-112233',
    payment_proof_path: 'proofs/103.jpg',
    payment_deadline: null,
    payment_submitted_at: '2026-10-10T10:00:00Z',
    paid_at: '2026-10-10T11:00:00Z',
    payment_review_note: null,
    order_items: [],
  },
  {
    id: 104,
    user_id: 'user-4',
    created_at: '2026-10-09T08:00:00Z',
    updated_at: '2026-10-09T18:00:00Z',
    status: 'delivered',
    payment_status: 'paid',
    payment_method: 'cod',
    delivery_method: 'representative',
    subtotal: 300,
    shipping_fee: 40,
    total: 340,
    ship_name: 'أحمد إبراهيم',
    ship_phone: '01099887766',
    ship_alt_phone: null,
    ship_governorate: 'القاهرة',
    ship_city: 'المعادي',
    ship_district: null,
    ship_address: 'شارع 9',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: null,
    rep_name: 'مندوب أحمد',
    rep_phone: '01200000000',
    payment_reference: null,
    payment_proof_path: null,
    payment_deadline: null,
    payment_submitted_at: null,
    paid_at: '2026-10-09T18:00:00Z',
    payment_review_note: null,
    order_items: [],
  },
  {
    id: 105,
    user_id: 'user-5',
    created_at: '2026-10-08T12:00:00Z',
    updated_at: '2026-10-08T13:00:00Z',
    status: 'cancelled',
    payment_status: 'unpaid',
    payment_method: 'cod',
    delivery_method: 'egypt_post',
    subtotal: 150,
    shipping_fee: 50,
    total: 200,
    ship_name: 'كريم عادل',
    ship_phone: '01122334455',
    ship_alt_phone: null,
    ship_governorate: 'المنصورة',
    ship_city: null,
    ship_district: null,
    ship_address: 'شارع الجيش',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: null,
    rep_name: null,
    rep_phone: null,
    payment_reference: null,
    payment_proof_path: null,
    payment_deadline: null,
    payment_submitted_at: null,
    paid_at: null,
    payment_review_note: null,
    order_items: [],
  },
  {
    id: 106,
    user_id: 'user-6',
    created_at: '2026-10-12T11:00:00Z',
    updated_at: '2026-10-12T11:00:00Z',
    status: 'pending',
    payment_status: 'awaiting_approval',
    payment_method: 'instapay_qr',
    delivery_method: 'egypt_post',
    subtotal: 450,
    shipping_fee: 50,
    total: 500,
    ship_name: 'ريم طارق',
    ship_phone: '01011223344',
    ship_alt_phone: null,
    ship_governorate: 'القاهرة',
    ship_city: 'المعادي',
    ship_district: null,
    ship_address: 'شارع النصر',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: null,
    rep_name: null,
    rep_phone: null,
    payment_reference: null,
    payment_proof_path: null,
    payment_deadline: null,
    payment_submitted_at: null,
    paid_at: null,
    payment_review_note: null,
    order_items: [],
  },
  {
    id: 107,
    user_id: 'user-7',
    created_at: '2026-10-12T11:30:00Z',
    updated_at: '2026-10-12T11:30:00Z',
    status: 'confirmed',
    payment_status: 'awaiting_proof',
    payment_method: 'instapay_qr',
    delivery_method: 'egypt_post',
    subtotal: 450,
    shipping_fee: 50,
    total: 500,
    ship_name: 'هبة خالد',
    ship_phone: '01122334455',
    ship_alt_phone: null,
    ship_governorate: 'الجيزة',
    ship_city: 'الدقي',
    ship_district: null,
    ship_address: 'شارع التحرير',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: null,
    rep_name: null,
    rep_phone: null,
    payment_reference: null,
    payment_proof_path: null,
    payment_deadline: new Date(Date.now() + 3600_000).toISOString(),
    payment_submitted_at: null,
    paid_at: null,
    payment_review_note: null,
    order_items: [],
  },
]

function renderWithProviders(ui: React.ReactElement, entry = '/admin/orders') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  )
}

describe('T-5.05 Orders Administration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('Status Transitions Helper (transitions.ts)', () => {
    it('returns allowed transitions along the standard progression path', () => {
      expect(getAllowedTransitions('pending')).toEqual(['confirmed', 'cancelled'])
      expect(getAllowedTransitions('confirmed')).toEqual(['shipped', 'cancelled'])
      expect(getAllowedTransitions('shipped')).toEqual(['delivered', 'cancelled'])
      expect(getAllowedTransitions('delivered')).toEqual(['cancelled'])
    })

    it('cancelled status is strictly terminal with no allowed transitions', () => {
      expect(getAllowedTransitions('cancelled')).toEqual([])
    })

    it('isTransitionAllowed returns true for valid standard moves and cancellation', () => {
      // Standard progression path
      expect(isTransitionAllowed('pending', 'confirmed')).toBe(true)
      expect(isTransitionAllowed('confirmed', 'shipped')).toBe(true)
      expect(isTransitionAllowed('shipped', 'delivered')).toBe(true)

      // Cancel from any state
      expect(isTransitionAllowed('pending', 'cancelled')).toBe(true)
      expect(isTransitionAllowed('confirmed', 'cancelled')).toBe(true)
      expect(isTransitionAllowed('shipped', 'cancelled')).toBe(true)
      expect(isTransitionAllowed('delivered', 'cancelled')).toBe(true)
    })

    it('isTransitionAllowed rejects invalid moves, jumps, and reopening cancelled orders (ORD-014)', () => {
      // Direct state jumps
      expect(isTransitionAllowed('pending', 'shipped')).toBe(false)
      expect(isTransitionAllowed('pending', 'delivered')).toBe(false)
      expect(isTransitionAllowed('confirmed', 'delivered')).toBe(false)

      // Backward transitions
      expect(isTransitionAllowed('delivered', 'shipped')).toBe(false)
      expect(isTransitionAllowed('delivered', 'confirmed')).toBe(false)
      expect(isTransitionAllowed('shipped', 'confirmed')).toBe(false)
      expect(isTransitionAllowed('shipped', 'pending')).toBe(false)

      // Reopening cancelled orders (ORD-014)
      expect(isTransitionAllowed('cancelled', 'pending')).toBe(false)
      expect(isTransitionAllowed('cancelled', 'confirmed')).toBe(false)
      expect(isTransitionAllowed('cancelled', 'shipped')).toBe(false)
      expect(isTransitionAllowed('cancelled', 'delivered')).toBe(false)
      expect(isTransitionAllowed('cancelled', 'cancelled')).toBe(false)

      // Identity transitions
      expect(isTransitionAllowed('pending', 'pending')).toBe(false)
      expect(isTransitionAllowed('confirmed', 'confirmed')).toBe(false)
    })

    it('enforces ORD-015 by blocking shipped/delivered for unpaid InstaPay orders', () => {
      // Unpaid InstaPay cannot be shipped or delivered
      expect(
        getAllowedTransitions('confirmed', {
          payment_method: 'instapay_qr',
          payment_status: 'awaiting_proof',
        }),
      ).toEqual(['cancelled'])

      expect(
        isTransitionAllowed('confirmed', 'shipped', {
          payment_method: 'instapay_qr',
          payment_status: 'awaiting_proof',
        }),
      ).toBe(false)

      // Paid InstaPay can proceed to shipped
      expect(
        getAllowedTransitions('confirmed', {
          payment_method: 'instapay_qr',
          payment_status: 'paid',
        }),
      ).toEqual(['shipped', 'cancelled'])

      expect(
        isTransitionAllowed('confirmed', 'shipped', {
          payment_method: 'instapay_qr',
          payment_status: 'paid',
        }),
      ).toBe(true)
    })

    it('blocks standard transitions when payment_status is awaiting_approval', () => {
      expect(
        getAllowedTransitions('pending', {
          payment_method: 'instapay_qr',
          payment_status: 'awaiting_approval',
        }),
      ).toEqual([])

      expect(
        isTransitionAllowed('pending', 'confirmed', {
          payment_method: 'instapay_qr',
          payment_status: 'awaiting_approval',
        }),
      ).toBe(false)
    })

    it('formats Egyptian phone numbers correctly for WhatsApp', () => {
      expect(formatEgyptianPhoneForWhatsApp('01012345678')).toBe('201012345678')
      expect(formatEgyptianPhoneForWhatsApp('+201012345678')).toBe('201012345678')
      expect(formatEgyptianPhoneForWhatsApp('201012345678')).toBe('201012345678')
      expect(formatEgyptianPhoneForWhatsApp('012-345-67890')).toBe('201234567890')
    })

    it('generates WhatsApp approval URL with customer phone, order #, and pay link', () => {
      const url = getOrderWhatsAppApprovalUrl({
        id: 106,
        ship_name: 'ريم طارق',
        ship_phone: '01011223344',
      })
      expect(url).toContain('https://wa.me/201011223344?text=')
      expect(url).toContain(encodeURIComponent('ريم طارق'))
      expect(url).toContain(encodeURIComponent('#106'))
      expect(url).toContain(encodeURIComponent('/pay/106'))
    })
  })

  describe('API Layer (api.ts)', () => {
    it('fetches orders without filters', async () => {
      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockOrders, error: null }),
      })
      vi.spyOn(getSupabase(), 'from').mockReturnValue({ select: selectMock } as never)

      const result = await api.getAdminOrders()
      expect(result).toHaveLength(mockOrders.length)
      expect(getSupabase().from).toHaveBeenCalledWith('orders')
    })

    it('applies status and payment_status filters', async () => {
      const eqMock = vi.fn().mockReturnThis()
      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          eq: eqMock,
        }),
      })
      vi.spyOn(getSupabase(), 'from').mockReturnValue({ select: selectMock } as never)

      await api.getAdminOrders({
        status: 'confirmed',
        payment_status: 'paid',
        search: '',
      })

      expect(eqMock).toHaveBeenCalledWith('status', 'confirmed')
      expect(eqMock).toHaveBeenCalledWith('payment_status', 'paid')
    })

    it('applies search by order ID when numeric or prefixed with #', async () => {
      const orMock = vi.fn().mockResolvedValue({ data: [mockOrders[0]], error: null })
      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          or: orMock,
        }),
      })
      vi.spyOn(getSupabase(), 'from').mockReturnValue({ select: selectMock } as never)

      await api.getAdminOrders({
        status: 'all',
        payment_status: 'all',
        search: '#101',
      })

      expect(orMock).toHaveBeenCalledWith(expect.stringContaining('id.eq.101'))
    })

    it('applies text search for customer name and phone', async () => {
      const orMock = vi.fn().mockResolvedValue({ data: [mockOrders[0]], error: null })
      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          or: orMock,
        }),
      })
      vi.spyOn(getSupabase(), 'from').mockReturnValue({ select: selectMock } as never)

      await api.getAdminOrders({
        status: 'all',
        payment_status: 'all',
        search: 'سارة',
      })

      expect(orMock).toHaveBeenCalledWith(expect.stringContaining('ship_name.ilike.%سارة%'))
    })

    it('maps database error hint to AppError code ORD-014 when trying to reopen cancelled order', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'A cancelled order cannot be re-opened',
          code: '22023',
          hint: 'ORD-014',
        },
      })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const eqMock = vi.fn().mockReturnValue({ select: selectMock })
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
      vi.spyOn(getSupabase(), 'from').mockReturnValue({ update: updateMock } as never)

      await expect(api.updateAdminOrderStatus(105, { status: 'pending' })).rejects.toThrow(AppError)

      try {
        await api.updateAdminOrderStatus(105, { status: 'pending' })
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('ORD-014')
        expect((err as AppError).message).toBe('لا يمكن إعادة فتح طلب ملغي.')
      }
    })

    it('calls admin_approve_order RPC with order ID and note', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(getSupabase(), 'rpc').mockImplementation(rpcMock as never)

      await api.adminApproveOrder(106, 'Approved manually')
      expect(rpcMock).toHaveBeenCalledWith('admin_approve_order', {
        p_order_id: 106,
        p_note: 'Approved manually',
      })
    })

    it('calls admin_reject_order RPC with order ID and reason', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(getSupabase(), 'rpc').mockImplementation(rpcMock as never)

      await api.adminRejectOrder(106, 'Customer uncontactable')
      expect(rpcMock).toHaveBeenCalledWith('admin_reject_order', {
        p_order_id: 106,
        p_reason: 'Customer uncontactable',
      })
    })
  })

  describe('OrdersPage UI Rendering & Interactions', () => {
    it('renders orders table with correct customer details, amounts, and badges', async () => {
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)

      renderWithProviders(<OrdersPage />)

      // Header and count
      expect(await screen.findByRole('heading', { name: 'إدارة الطلبات' })).toBeInTheDocument()
      expect(await screen.findByText(`${mockOrders.length} طلب`)).toBeInTheDocument()

      // Order IDs and customer names
      expect(screen.getByText('#101')).toBeInTheDocument()
      expect(screen.getByText('سارة أحمد')).toBeInTheDocument()
      expect(screen.getByText('01012345678')).toBeInTheDocument()

      expect(screen.getByText('#102')).toBeInTheDocument()
      expect(screen.getByText('محمود حسن')).toBeInTheDocument()

      // Status labels (present in both tabs and table rows)
      expect(screen.getAllByText(ORDER_STATUS_LABELS.pending).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(ORDER_STATUS_LABELS.confirmed).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(ORDER_STATUS_LABELS.shipped).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(ORDER_STATUS_LABELS.delivered).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(ORDER_STATUS_LABELS.cancelled).length).toBeGreaterThanOrEqual(1)
    })

    it('filters orders by clicking status tabs', async () => {
      const user = userEvent.setup()
      const getOrdersSpy = vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      // Click "مؤكد" status tab
      const confirmedTab = screen.getByRole('button', { name: 'مؤكد' })
      await user.click(confirmedTab)

      await waitFor(() => {
        expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }))
      })
    })

    it('filters orders by payment status dropdown', async () => {
      const user = userEvent.setup()
      const getOrdersSpy = vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      const select = screen.getByLabelText('حالة الدفع')
      await user.selectOptions(select, 'paid')

      await waitFor(() => {
        expect(getOrdersSpy).toHaveBeenCalledWith(
          expect.objectContaining({ payment_status: 'paid' }),
        )
      })
    })

    it('searches orders via search input', async () => {
      const user = userEvent.setup()
      const getOrdersSpy = vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      const searchInput = screen.getByLabelText('بحث في الطلبات')
      await user.type(searchInput, '101')

      await waitFor(() => {
        expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ search: '101' }))
      })
    })

    it('opens order detail modal when clicking a row', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      // Click row for order #101
      const orderRow = await screen.findByText('#101')
      await user.click(orderRow)

      // Detail modal opens with heading
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #101' })).toBeInTheDocument()

      // Full address details
      expect(screen.getByText('شارع عباس العقاد عمارة 10')).toBeInTheDocument()
      expect(screen.getByText('11511')).toBeInTheDocument()
      expect(screen.getByText(/الدور: 3/)).toBeInTheDocument()
      expect(screen.getByText(/شقة: 12/)).toBeInTheDocument()
      expect(screen.getByText(/(بجوار صيدلية العزبي)/)).toBeInTheDocument()

      // Customer notes
      expect(screen.getByText('يرجى الاتصال قبل الوصول')).toBeInTheDocument()

      // Item breakdown
      expect(screen.getByText('سوار ذهبي كلاسيكي')).toBeInTheDocument()

      // Available transition buttons for pending order: "تأكيد الطلب" and "إلغاء الطلب"
      expect(screen.getByRole('button', { name: 'تأكيد الطلب' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'إلغاء الطلب' })).toBeInTheDocument()
    })

    it('confirms and updates order status with prompt for Egypt Post tracking', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)
      const updateSpy = vi.spyOn(api, 'updateAdminOrderStatus').mockResolvedValue({
        ...mockOrders[1],
        status: 'shipped',
        tracking_number: 'EG999888',
      })

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      // Open Order #102 (confirmed)
      await user.click(await screen.findByText('#102'))
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #102' })).toBeInTheDocument()

      // Click "شحن الطلب"
      const shipButton = screen.getByRole('button', { name: 'شحن الطلب' })
      await user.click(shipButton)

      // Dialog opens
      expect(
        await screen.findByRole('heading', { name: /تغيير حالة الطلب #102/ }),
      ).toBeInTheDocument()

      // Fill representative phone
      const phoneInput = screen.getByLabelText('هاتف المندوب')
      await user.clear(phoneInput)
      await user.type(phoneInput, '01011112222')

      // Confirm update
      const confirmBtn = screen.getByRole('button', { name: 'تأكيد التحديث' })
      await user.click(confirmBtn)

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(102, {
          status: 'shipped',
          rep_name: 'كابتن علي',
          rep_phone: '01011112222',
        })
      })
    })

    it('displays prominent warning before cancelling and restocks inventory', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)
      const updateSpy = vi.spyOn(api, 'updateAdminOrderStatus').mockResolvedValue({
        ...mockOrders[0],
        status: 'cancelled',
      })

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      // Open Order #101 (pending)
      await user.click(await screen.findByText('#101'))
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #101' })).toBeInTheDocument()

      // Click "إلغاء الطلب"
      const cancelBtn = screen.getByRole('button', { name: 'إلغاء الطلب' })
      await user.click(cancelBtn)

      // Warning alert inside dialog
      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(
        screen.getByText(/تحذير هام: هذا الإجراء نهائي ولا يمكن التراجع عنه!/),
      ).toBeInTheDocument()
      expect(screen.getByText(/ORD-014/)).toBeInTheDocument()

      // Click confirm cancel
      const confirmCancelBtn = screen.getByRole('button', { name: 'نعم، قم بإلغاء الطلب' })
      await user.click(confirmCancelBtn)

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(101, {
          status: 'cancelled',
        })
      })
    })

    it('displays terminal notice and no transition buttons when viewing cancelled order', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      // Open Order #105 (cancelled)
      await user.click(await screen.findByText('#105'))
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #105' })).toBeInTheDocument()

      // Notice is displayed
      expect(screen.getByText(/هذا الطلب ملغي ونهائي \(ORD-014\)/)).toBeInTheDocument()

      // No transition buttons are available
      expect(screen.queryByRole('button', { name: 'تأكيد الطلب' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'شحن الطلب' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'إلغاء الطلب' })).not.toBeInTheDocument()
    })

    it('edits fulfillment details via OrderFulfillmentDialog', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)
      const fulfillmentSpy = vi.spyOn(api, 'updateAdminOrderFulfillment').mockResolvedValue({
        ...mockOrders[0],
        tracking_number: 'POST-123456',
      })

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      // Open Order #101
      await user.click(await screen.findByText('#101'))
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #101' })).toBeInTheDocument()

      // Click "تعديل البيانات"
      const editFulfillmentBtn = screen.getByRole('button', { name: 'تعديل البيانات' })
      await user.click(editFulfillmentBtn)

      // Fulfillment dialog opens
      expect(
        await screen.findByRole('heading', { name: 'تعديل بيانات الشحن للطلب #101' }),
      ).toBeInTheDocument()

      // Type tracking number
      const input = screen.getByLabelText('رقم التتبع (البريد المصري)')
      await user.type(input, 'POST-123456')

      // Save
      await user.click(screen.getByRole('button', { name: 'حفظ البيانات' }))

      await waitFor(() => {
        expect(fulfillmentSpy).toHaveBeenCalledWith(101, {
          tracking_number: 'POST-123456',
        })
      })
    })

    it('approves order and opens WhatsApp with prefilled message', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)
      const approveSpy = vi.spyOn(api, 'adminApproveOrder').mockResolvedValue(undefined)
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      // Order #106 has 'awaiting_approval' -> Action button is "مراجعة وموافقة"
      const reviewBtn = await screen.findByRole('button', { name: 'مراجعة وموافقة' })
      expect(reviewBtn).toBeInTheDocument()
      await user.click(reviewBtn)

      // Detail modal opens with approval options
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #106' })).toBeInTheDocument()
      expect(screen.getByText(/طلب إنستاباي جديد بانتظار موافقة المتجر/)).toBeInTheDocument()

      const waBtn = screen.getByRole('button', { name: 'موافقة وإرسال عبر واتساب' })
      await user.click(waBtn)

      await waitFor(() => {
        expect(approveSpy).toHaveBeenCalledWith(106, undefined)
        expect(openSpy).toHaveBeenCalledWith(
          expect.stringContaining('https://wa.me/201011223344?text='),
          '_blank',
        )
      })
    })

    it('approves order without WhatsApp', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)
      const approveSpy = vi.spyOn(api, 'adminApproveOrder').mockResolvedValue(undefined)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      await user.click(await screen.findByText('#106'))
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #106' })).toBeInTheDocument()

      const approveOnlyBtn = screen.getByRole('button', { name: 'موافقة فقط' })
      await user.click(approveOnlyBtn)

      await waitFor(() => {
        expect(approveSpy).toHaveBeenCalledWith(106, undefined)
      })
    })

    it('rejects order with mandatory reason via OrderRejectDialog', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)
      const rejectSpy = vi.spyOn(api, 'adminRejectOrder').mockResolvedValue(undefined)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      await user.click(await screen.findByText('#106'))
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #106' })).toBeInTheDocument()

      const rejectBtn = screen.getByRole('button', { name: 'رفض الطلب' })
      await user.click(rejectBtn)

      // Reject dialog opens
      expect(await screen.findByRole('heading', { name: 'رفض الطلب #106' })).toBeInTheDocument()
      expect(
        screen.getByText(/تنبيه: سيتم إلغاء الطلب واسترجاع المنتجات إلى المخزون/),
      ).toBeInTheDocument()

      const confirmBtn = screen.getByRole('button', { name: 'تأكيد الرفض والإلغاء' })
      expect(confirmBtn).toBeDisabled()

      // Fill reason
      const reasonInput = screen.getByLabelText(/سبب الرفض/)
      await user.type(reasonInput, 'تعذر التواصل مع العميل لتأكيد البيانات')
      expect(confirmBtn).not.toBeDisabled()

      await user.click(confirmBtn)

      await waitFor(() => {
        expect(rejectSpy).toHaveBeenCalledWith(106, 'تعذر التواصل مع العميل لتأكيد البيانات')
      })
    })

    it('enforces ORD-015 in UI by hiding ship button and showing warning for unpaid InstaPay orders', async () => {
      const user = userEvent.setup()
      vi.spyOn(api, 'getAdminOrders').mockResolvedValue(mockOrders)

      renderWithProviders(<OrdersPage />)
      await screen.findByRole('heading', { name: 'إدارة الطلبات' })

      // Open Order #107 (confirmed, instapay_qr, awaiting_proof)
      await user.click(await screen.findByText('#107'))
      expect(await screen.findByRole('heading', { name: 'تفاصيل الطلب #107' })).toBeInTheDocument()

      // Shows ORD-015 warning notice
      expect(
        screen.getByText(/تنبيه: لا يمكن شحن طلب إنستاباي قبل تأكيد استلام الدفع \(ORD-015\)\./),
      ).toBeInTheDocument()

      // "شحن الطلب" must not be present
      expect(screen.queryByRole('button', { name: 'شحن الطلب' })).not.toBeInTheDocument()

      // Cancellation is still permitted
      expect(screen.getByRole('button', { name: 'إلغاء الطلب' })).toBeInTheDocument()
    })
  })
})
