import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { canCancelOrder, type CustomerOrder } from './types'
import { OrderStatusTimeline } from './components/OrderStatusTimeline'
import { PaymentStatusBadge } from './components/PaymentStatusBadge'
import { getMyOrdersApi, cancelMyOrderApi } from './api'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

describe('canCancelOrder business rule', () => {
  it('allows cancellation for pending orders that are unpaid or awaiting proof', () => {
    expect(canCancelOrder({ status: 'pending', payment_status: 'unpaid' })).toBe(true)
    expect(canCancelOrder({ status: 'pending', payment_status: 'awaiting_proof' })).toBe(true)
    expect(canCancelOrder({ status: 'pending', payment_status: 'paid' })).toBe(true)
    expect(canCancelOrder({ status: 'pending', payment_status: 'rejected' })).toBe(true)
  })

  it('strictly disallows cancellation for pending orders under review', () => {
    expect(canCancelOrder({ status: 'pending', payment_status: 'under_review' })).toBe(false)
  })

  it('strictly disallows cancellation for non-pending orders regardless of payment status', () => {
    expect(canCancelOrder({ status: 'confirmed', payment_status: 'unpaid' })).toBe(false)
    expect(canCancelOrder({ status: 'shipped', payment_status: 'paid' })).toBe(false)
    expect(canCancelOrder({ status: 'delivered', payment_status: 'paid' })).toBe(false)
    expect(canCancelOrder({ status: 'cancelled', payment_status: 'unpaid' })).toBe(false)
  })
})

describe('OrderStatusTimeline', () => {
  it('renders progress timeline for pending order', () => {
    render(<OrderStatusTimeline status="pending" />)
    expect(screen.getByLabelText('مراحل حالة الطلب')).toBeInTheDocument()
    expect(screen.getByText('قيد الانتظار')).toBeInTheDocument()
    expect(screen.getByText('تم التأكيد')).toBeInTheDocument()
    expect(screen.getByText('تم الشحن')).toBeInTheDocument()
    expect(screen.getByText('تم التوصيل')).toBeInTheDocument()

    const step = screen.getByRole('listitem', { current: 'step' })
    expect(step).toHaveTextContent('قيد الانتظار')
  })

  it('renders progress timeline for shipped order', () => {
    render(<OrderStatusTimeline status="shipped" />)
    const step = screen.getByRole('listitem', { current: 'step' })
    expect(step).toHaveTextContent('تم الشحن')
  })

  it('renders cancelled indicator for cancelled order', () => {
    render(<OrderStatusTimeline status="cancelled" />)
    expect(screen.getByLabelText('حالة الطلب')).toBeInTheDocument()
    expect(screen.getByText('تم إلغاء الطلب')).toBeInTheDocument()
    expect(screen.queryByLabelText('مراحل حالة الطلب')).not.toBeInTheDocument()
  })
})

describe('PaymentStatusBadge', () => {
  it('renders correct labels for each payment status', () => {
    const { rerender } = render(<PaymentStatusBadge status="unpaid" />)
    expect(screen.getByText('غير مدفوع')).toBeInTheDocument()

    rerender(<PaymentStatusBadge status="awaiting_proof" />)
    expect(screen.getByText('بانتظار إيصال الدفع')).toBeInTheDocument()

    rerender(<PaymentStatusBadge status="under_review" />)
    expect(screen.getByText('قيد مراجعة الدفع')).toBeInTheDocument()

    rerender(<PaymentStatusBadge status="paid" />)
    expect(screen.getByText('تم الدفع')).toBeInTheDocument()

    rerender(<PaymentStatusBadge status="rejected" />)
    expect(screen.getByText('مرفوض')).toBeInTheDocument()
  })
})

describe('Orders API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getMyOrdersApi returns orders on success', async () => {
    const mockOrders: Partial<CustomerOrder>[] = [
      {
        id: 101,
        status: 'pending',
        payment_status: 'unpaid',
        total: 250,
      },
    ]

    const orderMock = vi.fn().mockResolvedValue({ data: mockOrders, error: null })
    const selectMock = vi.fn().mockReturnValue({ order: orderMock })
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as unknown as ReturnType<
      typeof supabase.from
    >)

    const result = await getMyOrdersApi()
    expect(result).toEqual(mockOrders)
    expect(supabase.from).toHaveBeenCalledWith('orders')
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('getMyOrdersApi throws AppError on failure', async () => {
    const orderMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Database error' } })
    const selectMock = vi.fn().mockReturnValue({ order: orderMock })
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as unknown as ReturnType<
      typeof supabase.from
    >)

    await expect(getMyOrdersApi()).rejects.toThrow()
  })

  it('cancelMyOrderApi calls cancel_my_order RPC with p_order_id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    await cancelMyOrderApi(42)
    expect(supabase.rpc).toHaveBeenCalledWith('cancel_my_order', { p_order_id: 42 })
  })

  it('cancelMyOrderApi throws AppError when RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Order not found', hint: 'ORD-009' },
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    await expect(cancelMyOrderApi(42)).rejects.toMatchObject({
      code: 'ORD-009',
    })
  })
})
