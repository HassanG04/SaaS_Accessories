import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getCustomerStatsApi, updateProfileApi } from './api'
import { useCustomerStats, useUpdateProfile } from './hooks'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Customer Account Feature (T-4.04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCustomerStatsApi', () => {
    it('fetches and normalizes stats from customer_stats view', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            orders_count: 5,
            total_spent: 1250.5,
            favorite_product_id: 42,
            favorite_product_name: 'خاتم فضة إسترليني',
          },
          error: null,
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getCustomerStatsApi()

      expect(supabase.from).toHaveBeenCalledWith('customer_stats')
      expect(mockSelect).toHaveBeenCalledWith(
        'orders_count, total_spent, favorite_product_id, favorite_product_name',
      )
      expect(result).toEqual({
        orders_count: 5,
        total_spent: 1250.5,
        favorite_product_id: 42,
        favorite_product_name: 'خاتم فضة إسترليني',
      })
    })

    it('defaults missing or zero values gracefully', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await getCustomerStatsApi()
      expect(result).toEqual({
        orders_count: 0,
        total_spent: 0,
        favorite_product_id: null,
        favorite_product_name: null,
      })
    })

    it('throws AppError on database query failure', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Network error', code: 'PGRST301' },
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      await expect(getCustomerStatsApi()).rejects.toThrow()
    })
  })

  describe('updateProfileApi', () => {
    it('updates allowed profile columns without touching role', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>)

      await updateProfileApi('user-123', {
        full_name: '  سارة أحمد  ',
        phone: '01012345678',
        alt_phone: '01198765432',
        governorate_id: 1,
        city: 'المنصورة',
        district: 'حي الجامعة',
        address: 'شارع الجمهورية',
        postal_code: '35511',
        floor: '4',
        apartment: '12',
        landmark: 'أمام الجامعة',
      })

      expect(supabase.from).toHaveBeenCalledWith('profiles')
      expect(mockUpdate).toHaveBeenCalledWith({
        full_name: 'سارة أحمد',
        phone: '01012345678',
        alt_phone: '01198765432',
        governorate_id: 1,
        city: 'المنصورة',
        district: 'حي الجامعة',
        address: 'شارع الجمهورية',
        postal_code: '35511',
        floor: '4',
        apartment: '12',
        landmark: 'أمام الجامعة',
      })
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123')

      // Strictly verify no role key in update payload
      const payload = mockUpdate.mock.calls[0][0]
      expect(payload).not.toHaveProperty('role')
    })
  })

  describe('useCustomerStats & useUpdateProfile hooks', () => {
    it('useCustomerStats hook queries customer stats successfully', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            orders_count: 3,
            total_spent: 450,
            favorite_product_id: null,
            favorite_product_name: null,
          },
          error: null,
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const { result } = renderHook(() => useCustomerStats(true), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data?.total_spent).toBe(450)
    })

    it('useUpdateProfile mutates profile successfully', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>)

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync({
        userId: 'u1',
        data: {
          full_name: 'نور',
          phone: '01011111111',
          alt_phone: null,
          governorate_id: null,
          city: null,
          district: null,
          address: null,
          postal_code: null,
          floor: null,
          apartment: null,
          landmark: null,
        },
      })

      expect(supabase.from).toHaveBeenCalledWith('profiles')
    })
  })
})
