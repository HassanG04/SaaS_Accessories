import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { ToastProvider } from '@/components/ui/ToastProvider'
import * as api from './api'
import PaymentsPage from './PaymentsPage'
import { ProofViewerModal } from './ProofViewerModal'
import { PaymentReviewDialog } from './PaymentReviewDialog'
import { PurgeProofsDialog } from './PurgeProofsDialog'
import { supabase } from '@/lib/supabase'
import { AppError } from '@/lib/errors'
import type { AdminPaymentOrder } from './types'

// Mock Supabase
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

// Mock useStepUp & StepUpDialog for deterministic test flows
const mockOpenStepUp = vi.fn((cb?: () => void) => {
  cb?.()
})
const mockCloseStepUp = vi.fn()
let mockIsStepUpConfirmed = false

vi.mock('@/features/auth/useStepUp', () => ({
  useStepUp: () => ({
    isConfirmed: mockIsStepUpConfirmed,
    openStepUp: mockOpenStepUp,
    dialogOpen: false,
    closeStepUp: mockCloseStepUp,
    confirmStepUp: vi.fn().mockResolvedValue({ success: true }),
    withStepUp: vi.fn(),
    resetStepUp: vi.fn(),
  }),
}))

vi.mock('@/features/auth/StepUpDialog', () => ({
  StepUpDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mock-step-up-dialog">Mock StepUp Dialog</div> : null,
}))

const mockOrders: AdminPaymentOrder[] = [
  {
    id: 201,
    user_id: 'user-1',
    created_at: '2026-10-10T10:00:00Z',
    updated_at: '2026-10-10T10:00:00Z',
    status: 'pending',
    payment_status: 'under_review',
    payment_method: 'instapay_qr',
    delivery_method: 'egypt_post',
    subtotal: 350,
    shipping_fee: 50,
    total: 400,
    ship_name: 'سارة أحمد',
    ship_phone: '01012345678',
    ship_alt_phone: null,
    ship_governorate: 'القاهرة',
    ship_city: 'مدينة نصر',
    ship_district: 'الحي السابع',
    ship_address: 'شارع عباس العقاد',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: null,
    rep_name: null,
    rep_phone: null,
    payment_reference: 'REF-111111',
    payment_proof_path: 'user-1/201/proof1.jpg',
    payment_deadline: '2026-10-11T10:00:00Z',
    payment_submitted_at: '2026-10-10T11:00:00Z',
    paid_at: null,
    payment_reviewed_by: null,
    payment_review_note: null,
  },
  {
    id: 202,
    user_id: 'user-2',
    created_at: '2026-10-11T12:00:00Z',
    updated_at: '2026-10-11T12:00:00Z',
    status: 'pending',
    payment_status: 'under_review',
    payment_method: 'instapay_qr',
    delivery_method: 'representative',
    subtotal: 500,
    shipping_fee: 40,
    total: 540,
    ship_name: 'محمود علي',
    ship_phone: '01234567890',
    ship_alt_phone: null,
    ship_governorate: 'الجيزة',
    ship_city: 'الدقي',
    ship_district: 'ميدان المساحة',
    ship_address: 'شارع مصدق',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: null,
    rep_name: null,
    rep_phone: null,
    payment_reference: 'REF-222222',
    payment_proof_path: 'user-2/202/proof2.png',
    payment_deadline: '2026-10-12T12:00:00Z',
    payment_submitted_at: '2026-10-11T12:30:00Z',
    paid_at: null,
    payment_reviewed_by: null,
    payment_review_note: null,
  },
  {
    id: 203,
    user_id: 'user-3',
    created_at: '2026-10-09T08:00:00Z',
    updated_at: '2026-10-09T08:00:00Z',
    status: 'confirmed',
    payment_status: 'paid',
    payment_method: 'instapay_qr',
    delivery_method: 'egypt_post',
    subtotal: 200,
    shipping_fee: 50,
    total: 250,
    ship_name: 'فاطمة حسن',
    ship_phone: '01511223344',
    ship_alt_phone: null,
    ship_governorate: 'الإسكندرية',
    ship_city: 'سموحة',
    ship_district: 'فيكتوريا',
    ship_address: 'شارع فؤاد',
    ship_floor: null,
    ship_apartment: null,
    ship_landmark: null,
    notes: null,
    tracking_number: null,
    rep_name: null,
    rep_phone: null,
    payment_reference: 'REF-333333',
    payment_proof_path: 'user-3/203/proof3.webp',
    payment_deadline: '2026-10-10T08:00:00Z',
    payment_submitted_at: '2026-10-09T08:30:00Z',
    paid_at: '2026-10-09T09:00:00Z',
    payment_reviewed_by: 'admin-uuid',
    payment_review_note: 'Verified with CIB',
  },
]

function renderWithProviders(ui: React.ReactElement, entry = '/admin/payments') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <LanguageProvider>
          <ToastProvider>{ui}</ToastProvider>
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Admin Payment Review API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStepUpConfirmed = false
  })

  it('opens the exact order from Orders, including an already reviewed payment', async () => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi
        .fn()
        .mockImplementation((resolve) => resolve({ data: [mockOrders[2]], error: null })),
    }
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(builder),
    } as unknown as ReturnType<typeof supabase.from>)
    renderWithProviders(<PaymentsPage />, '/admin/payments?order=203')
    expect(await screen.findByText('فاطمة حسن')).toBeInTheDocument()
    expect(builder.eq).toHaveBeenCalledWith('id', 203)
    expect(builder.eq).not.toHaveBeenCalledWith('payment_status', 'under_review')
    expect(screen.getByRole('button', { name: 'إلغاء تصفية الطلب #203' })).toBeInTheDocument()
  })

  it('counts only proofs under review and does not turn a failed query into zero', async () => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) => resolve({ count: 4, error: null })),
    }
    const select = vi.fn().mockReturnValue(builder)
    vi.mocked(supabase.from).mockReturnValue({ select } as unknown as ReturnType<
      typeof supabase.from
    >)
    expect(await api.getPaymentReviewCount()).toBe(4)
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(builder.eq).toHaveBeenCalledWith('payment_status', 'under_review')
    builder.then.mockImplementation((resolve) =>
      resolve({ count: null, error: { hint: 'ADM-002' } }),
    )
    await expect(api.getPaymentReviewCount()).rejects.toMatchObject({ code: 'ADM-002' })
  })

  it('fetches under_review orders sorted oldest first (ascending)', async () => {
    const mockOrderBuilder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) =>
        resolve({
          data: [mockOrders[0], mockOrders[1]],
          error: null,
        }),
      ),
    }

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(mockOrderBuilder),
    } as unknown as ReturnType<typeof supabase.from>)

    const result = await api.getAdminPaymentOrders({ status: 'under_review' })

    expect(supabase.from).toHaveBeenCalledWith('orders')
    expect(mockOrderBuilder.eq).toHaveBeenCalledWith('payment_method', 'instapay_qr')
    expect(mockOrderBuilder.eq).toHaveBeenCalledWith('payment_status', 'under_review')
    expect(mockOrderBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toHaveLength(2)
  })

  it('generates a 60-second signed URL for payment proof', async () => {
    const mockStorageFrom = {
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-proof.jpg?token=secret123' },
        error: null,
      }),
    }

    vi.mocked(supabase.storage.from).mockReturnValue(
      mockStorageFrom as unknown as ReturnType<typeof supabase.storage.from>,
    )

    const url = await api.getSignedProofUrl('user-1/201/proof1.jpg', 60)

    expect(supabase.storage.from).toHaveBeenCalledWith('payment-proofs')
    expect(mockStorageFrom.createSignedUrl).toHaveBeenCalledWith('user-1/201/proof1.jpg', 60)
    expect(url).toBe('https://example.com/signed-proof.jpg?token=secret123')
  })

  it('reviews payment via admin_review_payment RPC (approve)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    await api.adminReviewPayment({
      orderId: 201,
      approve: true,
      note: 'Verified with bank app',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('admin_review_payment', {
      p_order_id: 201,
      p_approve: true,
      p_note: 'Verified with bank app',
    })
  })

  it('reviews payment via admin_review_payment RPC (reject with note)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    await api.adminReviewPayment({
      orderId: 202,
      approve: false,
      note: 'Transfer amount does not match order total',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('admin_review_payment', {
      p_order_id: 202,
      p_approve: false,
      p_note: 'Transfer amount does not match order total',
    })
  })

  it('maps database error when reviewing payment', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Order is already paid', hint: 'PAY-002', code: '22023' },
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    await expect(
      api.adminReviewPayment({
        orderId: 203,
        approve: true,
      }),
    ).rejects.toThrow(AppError)
  })

  it('purges delivered payment proofs older than 90 days', async () => {
    const mockOrderBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: [
          { id: 99, payment_proof_path: 'user-old/99/proof.jpg' },
          { id: 100, payment_proof_path: 'user-old/100/proof.png' },
        ],
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(
      mockOrderBuilder as unknown as ReturnType<typeof supabase.from>,
    )

    const mockStorageFrom = {
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(
      mockStorageFrom as unknown as ReturnType<typeof supabase.storage.from>,
    )

    const result = await api.purgeOldProofs(90)

    expect(mockStorageFrom.remove).toHaveBeenCalledWith([
      'user-old/99/proof.jpg',
      'user-old/100/proof.png',
    ])
    expect(mockOrderBuilder.update).toHaveBeenCalledWith({ payment_proof_path: null })
    expect(mockOrderBuilder.in).toHaveBeenCalledWith('id', [99, 100])
    expect(result.purgedCount).toBe(2)
  })

  it('returns 0 when no eligible orders exist for purging', async () => {
    const mockOrderBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(
      mockOrderBuilder as unknown as ReturnType<typeof supabase.from>,
    )

    const result = await api.purgeOldProofs(90)

    expect(result.purgedCount).toBe(0)
    expect(result.orderIds).toEqual([])
  })
})

describe('PaymentsPage UI & Interactivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStepUpConfirmed = false
  })

  it('renders payments page header, filter tabs, and order queue', async () => {
    const mockOrderBuilder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) =>
        resolve({
          data: [mockOrders[0], mockOrders[1]],
          error: null,
        }),
      ),
    }

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(mockOrderBuilder),
    } as unknown as ReturnType<typeof supabase.from>)

    renderWithProviders(<PaymentsPage />)

    expect(await screen.findByText('مراجعة المدفوعات')).toBeInTheDocument()
    expect(screen.getByText('قيد المراجعة')).toBeInTheDocument()
    expect(await screen.findByText('سارة أحمد')).toBeInTheDocument()
    expect(screen.getByText('محمود علي')).toBeInTheDocument()
    expect(screen.getByText('REF-111111')).toBeInTheDocument()
    expect(screen.getByText('REF-222222')).toBeInTheDocument()
  })

  it('opens proof viewer modal with 60-second signed link', async () => {
    const user = userEvent.setup()

    const mockOrderBuilder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) =>
        resolve({
          data: [mockOrders[0]],
          error: null,
        }),
      ),
    }

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(mockOrderBuilder),
    } as unknown as ReturnType<typeof supabase.from>)

    const mockStorageFrom = {
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-proof.jpg' },
        error: null,
      }),
    }

    vi.mocked(supabase.storage.from).mockReturnValue(
      mockStorageFrom as unknown as ReturnType<typeof supabase.storage.from>,
    )

    renderWithProviders(<PaymentsPage />)

    const viewProofBtn = await screen.findByRole('button', { name: /عرض الإثبات/i })
    await user.click(viewProofBtn)

    expect(await screen.findByText(/إثبات الدفع للطلب #201/i)).toBeInTheDocument()
    expect(screen.getByText(/60 ثانية/i)).toBeInTheDocument()
    expect(mockStorageFrom.createSignedUrl).toHaveBeenCalledWith('user-1/201/proof1.jpg', 60)
  })

  it('opens review dialog and submits approval', async () => {
    const user = userEvent.setup()

    const mockOrderBuilder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) =>
        resolve({
          data: [mockOrders[0]],
          error: null,
        }),
      ),
    }

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(mockOrderBuilder),
    } as unknown as ReturnType<typeof supabase.from>)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    renderWithProviders(<PaymentsPage />)

    const approveBtn = await screen.findByRole('button', { name: /^قبول$/i })
    await user.click(approveBtn)

    expect(await screen.findByText(/تأكيد قبول الدفع للطلب #201/i)).toBeInTheDocument()

    const confirmApproveBtn = screen.getByRole('button', { name: /تأكيد قبول الدفع/i })
    await user.click(confirmApproveBtn)

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_review_payment', {
        p_order_id: 201,
        p_approve: true,
        p_note: null,
      })
    })
  })

  it('opens review dialog and submits rejection with note', async () => {
    const user = userEvent.setup()

    const mockOrderBuilder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) =>
        resolve({
          data: [mockOrders[1]],
          error: null,
        }),
      ),
    }

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(mockOrderBuilder),
    } as unknown as ReturnType<typeof supabase.from>)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    renderWithProviders(<PaymentsPage />)

    const rejectBtn = await screen.findByRole('button', { name: /^رفض$/i })
    await user.click(rejectBtn)

    expect(await screen.findByText(/رفض إيصال الدفع للطلب #202/i)).toBeInTheDocument()

    const noteInput = screen.getByLabelText(/سبب الرفض/i)
    await user.type(noteInput, 'رقم العملية غير مطابق')

    const confirmRejectBtn = screen.getByRole('button', { name: /تأكيد رفض الإيصال/i })
    await user.click(confirmRejectBtn)

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('admin_review_payment', {
        p_order_id: 202,
        p_approve: false,
        p_note: 'رقم العملية غير مطابق',
      })
    })
  })

  it('opens purge dialog for old proofs and triggers step-up when unconfirmed', async () => {
    const user = userEvent.setup()
    mockIsStepUpConfirmed = false

    const mockOrderBuilder = {
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
      order: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) =>
        resolve({
          data: [],
          error: null,
        }),
      ),
    }

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(mockOrderBuilder),
    } as unknown as ReturnType<typeof supabase.from>)

    renderWithProviders(<PaymentsPage />)

    const purgeBtn = await screen.findByRole('button', { name: /تطهير الإثباتات القديمة/i })
    await user.click(purgeBtn)

    expect(await screen.findByText(/تطهير إثباتات الدفع القديمة/i)).toBeInTheDocument()
    expect(screen.getByText(/SEC-07/i)).toBeInTheDocument()

    const startPurgeBtn = screen.getByRole('button', { name: /بدء التطهير/i })
    await user.click(startPurgeBtn)

    expect(mockOpenStepUp).toHaveBeenCalled()
  })
})

describe('ProofViewerModal standalone', () => {
  it('renders copy reference button and allows copy', async () => {
    const user = userEvent.setup()

    const mockStorageFrom = {
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/test.jpg' },
        error: null,
      }),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(
      mockStorageFrom as unknown as ReturnType<typeof supabase.storage.from>,
    )

    const onClose = vi.fn()
    renderWithProviders(<ProofViewerModal open={true} order={mockOrders[0]} onClose={onClose} />)

    expect(await screen.findByText('REF-111111')).toBeInTheDocument()

    const copyBtn = screen.getByRole('button', { name: /نسخ/i })
    await user.click(copyBtn)

    await waitFor(() => {
      expect(screen.getByText(/تم النسخ/i)).toBeInTheDocument()
    })
  })
})

describe('PaymentReviewDialog standalone', () => {
  it('displays order amount and customer name', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <PaymentReviewDialog open={true} order={mockOrders[0]} action="approve" onClose={onClose} />,
    )

    expect(await screen.findByText('سارة أحمد')).toBeInTheDocument()
    expect(screen.getByText(/400/)).toBeInTheDocument()
  })
})

describe('PurgeProofsDialog standalone', () => {
  it('renders description and cancel button closes dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderWithProviders(<PurgeProofsDialog open={true} onClose={onClose} />)

    expect(await screen.findByText(/تطهير إثباتات الدفع القديمة/i)).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /إلغاء/i })
    await user.click(cancelBtn)

    expect(onClose).toHaveBeenCalled()
  })
})
