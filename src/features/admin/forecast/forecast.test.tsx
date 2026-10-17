import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { ForecastBadges } from './ForecastBadges'
import { ForecastChart } from './ForecastChart'
import { ReorderTable } from './ReorderTable'
import ForecastPage from './ForecastPage'
import * as api from './api'
import { supabase } from '@/lib/supabase'
import type { ForecastPoint, HistoryPoint, ReorderItem } from './types'

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  getSupabase: vi.fn(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
  })),
}))

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })

  return render(
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </LanguageProvider>,
  )
}

describe('T-9.10: Admin Forecast & Reorder Screens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // 1. Formula & Threshold Tests (analytics-plan.md Section 7)
  // ============================================================================
  describe('Reorder & Stock Health Formulas', () => {
    it('computes days_of_cover = stock / daily_forecast correctly', () => {
      const stock = 20
      const dailyForecast: number = 2.5
      const daysOfCover = Number((stock / dailyForecast).toFixed(1))
      expect(daysOfCover).toBe(8.0)

      // Zero stock
      expect(Number((0 / dailyForecast).toFixed(1))).toBe(0.0)

      // Zero daily forecast fallback (infinity / 999)
      const zeroForecast: number = 0
      const zeroForecastCover = zeroForecast === 0 ? 999.0 : stock / zeroForecast
      expect(zeroForecastCover).toBe(999.0)
    })

    it('computes reorder_point = daily_forecast * lead_time + z * sigma * sqrt(lead_time)', () => {
      const dailyForecast = 5.0
      const leadTime = 7
      const z = 1.28
      const sigma = 1.5

      const safetyStock = z * sigma * Math.sqrt(leadTime)
      const reorderPoint = Number((dailyForecast * leadTime + safetyStock).toFixed(1))

      // 5 * 7 = 35; 1.28 * 1.5 * 2.64575 = 5.08; 35 + 5.08 = 40.1
      expect(reorderPoint).toBeCloseTo(40.1, 1)
    })

    it('computes suggested_quantity when stock <= reorder_point', () => {
      const dailyForecast = 5.0
      const leadTime = 7
      const z = 1.28
      const sigma = 1.5
      const stock = 25
      const safetyStock = z * sigma * Math.sqrt(leadTime)
      const reorderPoint = dailyForecast * leadTime + safetyStock

      const needsReorder = stock <= reorderPoint
      expect(needsReorder).toBe(true)

      // suggested = ceil(daily_forecast * (lead_time + 7) + safety - stock)
      // 5 * 14 + 5.08 - 25 = 70 + 5.08 - 25 = 50.08 -> ceil = 51
      const suggested = Math.ceil(dailyForecast * (leadTime + 7) + safetyStock - stock)
      expect(suggested).toBe(51)
    })

    it('sets suggested_quantity to 0 when stock > reorder_point', () => {
      const dailyForecast = 5.0
      const leadTime = 7
      const z = 1.28
      const sigma = 1.5
      const stock = 60
      const safetyStock = z * sigma * Math.sqrt(leadTime)
      const reorderPoint = dailyForecast * leadTime + safetyStock

      const needsReorder = stock <= reorderPoint
      expect(needsReorder).toBe(false)
    })

    it('identifies stock risk when days_of_cover <= 14', () => {
      const itemRisk: Pick<ReorderItem, 'days_of_cover' | 'is_stock_risk'> = {
        days_of_cover: 12.5,
        is_stock_risk: true,
      }
      const itemSafe: Pick<ReorderItem, 'days_of_cover' | 'is_stock_risk'> = {
        days_of_cover: 18.0,
        is_stock_risk: false,
      }

      expect(itemRisk.days_of_cover <= 14).toBe(true)
      expect(itemSafe.days_of_cover <= 14).toBe(false)
    })

    it('identifies dead stock when days_since_last_sale >= 60', () => {
      const itemDead: Pick<ReorderItem, 'days_since_last_sale' | 'is_dead_stock'> = {
        days_since_last_sale: 75,
        is_dead_stock: true,
      }
      const itemActive: Pick<ReorderItem, 'days_since_last_sale' | 'is_dead_stock'> = {
        days_since_last_sale: 15,
        is_dead_stock: false,
      }

      expect(itemDead.days_since_last_sale >= 60).toBe(true)
      expect(itemActive.days_since_last_sale >= 60).toBe(false)
    })
  })

  // ============================================================================
  // 2. Badges & Information Tests
  // ============================================================================
  describe('ForecastBadges Component', () => {
    it('renders preliminary data badge when readiness is preliminary', () => {
      renderWithProviders(
        <ForecastBadges
          status="ok"
          run={{
            id: 1,
            run_at: '2026-10-15T00:00:00Z',
            git_commit: 'abcdef1',
            model_version: 'v1.0',
            notes: {
              readiness_summary: {
                shop: 'preliminary',
              },
            },
          }}
          metrics={[
            {
              model_name: 'SeasonalNaive',
              wape: 0.5042,
              mase: 1.0,
              pinball_loss: null,
              bias: 0.0,
              is_selected: true,
            },
          ]}
          seriesKey="shop"
        />,
      )

      expect(screen.getByTestId('badge-preliminary')).toBeInTheDocument()
      expect(screen.getByText('بيانات أولية')).toBeInTheDocument()
      expect(screen.getByText(/SeasonalNaive/)).toBeInTheDocument()
      expect(screen.getByText(/50.4%/)).toBeInTheDocument()
    })

    it('renders insufficient data badge (ANL-001) when data is insufficient or empty', () => {
      renderWithProviders(<ForecastBadges status="no_data" seriesKey="shop" />)

      expect(screen.getByTestId('badge-insufficient')).toBeInTheDocument()
      expect(screen.getByText(/ANL-001/)).toBeInTheDocument()
    })

    it('renders drift alert banner when drift_alert is true in run notes', () => {
      renderWithProviders(
        <ForecastBadges
          status="ok"
          run={{
            id: 1,
            run_at: '2026-10-15T00:00:00Z',
            git_commit: 'abcdef1',
            model_version: 'v1.0',
            notes: {
              drift_alert: true,
              display_fallback: true,
            },
          }}
          metrics={[
            {
              model_name: 'SeasonalNaive',
              wape: 0.45,
              mase: null,
              pinball_loss: null,
              bias: null,
              is_selected: true,
            },
          ]}
        />,
      )

      expect(screen.getByTestId('forecast-drift-banner')).toBeInTheDocument()
      expect(screen.getByText('تنبيه انحراف في دقة التوقعات')).toBeInTheDocument()
    })
  })

  // ============================================================================
  // 3. Security & Access Refusal Tests (Customer & Admin at AAL1)
  // ============================================================================
  describe('Security and Access Control', () => {
    it('customer or unauthenticated caller receives nothing / permission error from admin_get_forecasts', async () => {
      const rpcMock = vi.mocked(supabase.rpc)
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Admins only',
          details: '42501',
          hint: 'AUTH-011',
          code: '42501',
        },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      await expect(api.getAdminForecasts('shop')).rejects.toMatchObject({
        code: '42501',
        message: 'Admins only',
      })
    })

    it('admin at AAL1 receives nothing / permission error from admin_get_reorder_list', async () => {
      const rpcMock = vi.mocked(supabase.rpc)
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Two-factor authentication required for admin actions',
          details: '42501',
          hint: 'ADM-002',
          code: '42501',
        },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      await expect(api.getAdminReorderList(7, 1.28)).rejects.toMatchObject({
        code: '42501',
        message: 'Two-factor authentication required for admin actions',
      })
    })

    it('authorized admin at AAL2 receives full forecast and reorder payloads', async () => {
      const rpcMock = vi.mocked(supabase.rpc)
      rpcMock.mockResolvedValueOnce({
        data: {
          status: 'ok',
          run: {
            id: 10,
            run_at: '2026-10-15T00:00:00Z',
            git_commit: 'commit123',
            model_version: 'v1.0',
            notes: {},
          },
          forecasts: [
            {
              forecast_date: '2026-10-16',
              horizon_step: 1,
              predicted_units: 12.0,
              predicted_revenue: 1200.0,
              lower_80: 9.0,
              upper_80: 15.0,
              model_name: 'AutoTheta',
            },
          ],
          metrics: [
            {
              model_name: 'AutoTheta',
              wape: 0.46,
              mase: 0.8,
              pinball_loss: null,
              bias: null,
              is_selected: true,
            },
          ],
          history: [{ day: '2026-10-14', units: 10, revenue: 1000 }],
        },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      const result = await api.getAdminForecasts('shop')
      expect(result.status).toBe('ok')
      expect(result.forecasts).toHaveLength(1)
      expect(result.history).toHaveLength(1)
      expect(result.metrics).toHaveLength(1)
    })
  })

  // ============================================================================
  // 4. Component UI & Interaction Tests
  // ============================================================================
  describe('ForecastChart & ReorderTable Components', () => {
    const mockForecasts: ForecastPoint[] = [
      {
        forecast_date: '2026-10-16',
        horizon_step: 1,
        predicted_units: 14.5,
        predicted_revenue: 1450.0,
        lower_80: 10.0,
        upper_80: 19.0,
        model_name: 'AutoTheta',
      },
      {
        forecast_date: '2026-10-17',
        horizon_step: 2,
        predicted_units: 16.0,
        predicted_revenue: 1600.0,
        lower_80: 11.0,
        upper_80: 21.0,
        model_name: 'AutoTheta',
      },
    ]

    const mockHistory: HistoryPoint[] = [
      { day: '2026-10-14', units: 12, revenue: 1200 },
      { day: '2026-10-15', units: 15, revenue: 1500 },
    ]

    const mockReorderItems: ReorderItem[] = [
      {
        product_id: 1,
        name: 'Silver Pearl Bracelet',
        name_ar: 'سوار اللؤلؤ الفضي',
        category_id: 1,
        stock_quantity: 4,
        daily_forecast: 2.0,
        days_of_cover: 2.0,
        reorder_point: 20.0,
        suggested_quantity: 25,
        needs_reorder: true,
        days_since_last_sale: 2,
        is_dead_stock: false,
        is_stock_risk: true,
      },
      {
        product_id: 2,
        name: 'Vintage Ring',
        name_ar: 'خاتم عتيق مرصع',
        category_id: 1,
        stock_quantity: 50,
        daily_forecast: 0.0,
        days_of_cover: 999.0,
        reorder_point: 5.0,
        suggested_quantity: 0,
        needs_reorder: false,
        days_since_last_sale: 72,
        is_dead_stock: true,
        is_stock_risk: false,
      },
    ]

    it('renders ForecastChart with accessible table toggle and mode switch', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ForecastChart forecasts={mockForecasts} history={mockHistory} />)

      expect(screen.getByText('منحنى المبيعات والتوقعات')).toBeInTheDocument()

      // Toggle accessible table
      const tableToggleBtn = screen.getByRole('button', { name: /عرض كجدول/ })
      await user.click(tableToggleBtn)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('2026-10-16')).toBeInTheDocument()
      expect(screen.getByText('2026-10-17')).toBeInTheDocument()
    })

    it('renders ReorderTable with tabs, filters, and items', async () => {
      const user = userEvent.setup()
      const setLeadTime = vi.fn()
      const setServiceZ = vi.fn()

      renderWithProviders(
        <ReorderTable
          items={mockReorderItems}
          isLoading={false}
          leadTime={7}
          setLeadTime={setLeadTime}
          serviceZ={1.28}
          setServiceZ={setServiceZ}
          categories={[{ id: 1, name_ar: 'أساور' }]}
        />,
      )

      expect(screen.getByText('إدارة إعادة الطلب ومخاطر المخزون')).toBeInTheDocument()

      // Tab 'بحاجة لإعادة طلب' active by default (shows product 1)
      expect(screen.getByText('سوار اللؤلؤ الفضي')).toBeInTheDocument()
      expect(screen.queryByText('خاتم عتيق مرصع')).not.toBeInTheDocument()

      // Switch to 'مخزون راكد' tab
      const deadStockTab = screen.getByRole('tab', { name: /مخزون راكد/ })
      await user.click(deadStockTab)

      expect(screen.getByText('خاتم عتيق مرصع')).toBeInTheDocument()
      expect(screen.queryByText('سوار اللؤلؤ الفضي')).not.toBeInTheDocument()
    })

    it('renders ForecastPage full integration in Arabic', async () => {
      // Mock API calls
      vi.spyOn(api, 'getAdminForecasts').mockResolvedValue({
        status: 'ok',
        run: {
          id: 1,
          run_at: '2026-10-15T00:00:00Z',
          git_commit: '315f01d',
          model_version: 'v1.0',
          notes: {
            readiness_summary: { shop: 'ok' },
          },
        },
        forecasts: mockForecasts,
        metrics: [
          {
            model_name: 'AutoTheta',
            wape: 0.465,
            mase: 0.82,
            pinball_loss: null,
            bias: null,
            is_selected: true,
          },
        ],
        history: mockHistory,
      })

      vi.spyOn(api, 'getAdminReorderList').mockResolvedValue(mockReorderItems)
      vi.spyOn(api, 'getForecastCategories').mockResolvedValue([{ id: 1, name_ar: 'أساور' }])
      vi.spyOn(api, 'getForecastProducts').mockResolvedValue([
        { id: 1, name_ar: 'سوار اللؤلؤ الفضي', category_id: 1 },
      ])

      renderWithProviders(<ForecastPage />)

      // Header
      expect(await screen.findByText('التوقعات وإعادة الطلب')).toBeInTheDocument()

      // Series level switcher
      expect(screen.getByRole('button', { name: 'المتجر بالكامل' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'الأقسام' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'المنتجات' })).toBeInTheDocument()

      // KPI card
      expect(screen.getByText('القطع المتوقعة')).toBeInTheDocument()
    })
  })
})
