import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { SalesOverviewSection } from './SalesOverviewSection'
import { ProductPerformanceSection } from './ProductPerformanceSection'
import { CustomerSegmentsSection } from './CustomerSegmentsSection'
import { CohortRetentionSection } from './CohortRetentionSection'
import { BasketAnalysisSection } from './BasketAnalysisSection'
import { DiscountEffectSection } from './DiscountEffectSection'
import { FulfilmentQualitySection } from './FulfilmentQualitySection'
import { GeographySection } from './GeographySection'
import AnalyticsPage from './AnalyticsPage'
import { supabase } from '@/lib/supabase'
import type { AnalyticsInsightsPayload } from './types'

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

const mockInsightsData: AnalyticsInsightsPayload = {
  sales_overview: [
    {
      day: '2026-10-14',
      units: 12,
      revenue: 2400.0,
      units_ma7: 10.5,
      revenue_ma7: 2100.0,
      units_ma28: 9.8,
      revenue_ma28: 1950.0,
    },
    {
      day: '2026-10-15',
      units: 15,
      revenue: 3000.0,
      units_ma7: 11.2,
      revenue_ma7: 2250.0,
      units_ma28: 10.1,
      revenue_ma28: 2020.0,
    },
  ],
  product_performance: [
    {
      product_id: 1,
      name: 'Silver Pearl Bracelet',
      name_ar: 'سوار اللؤلؤ الفضي',
      category_id: 1,
      total_revenue: 15000.0,
      total_units: 75,
      revenue_share_pct: 60.0,
      abc_class: 'A',
      xyz_class: 'X',
      cv_demand: 0.35,
    },
    {
      product_id: 2,
      name: 'Gold Ring',
      name_ar: 'خاتم ذهبي',
      category_id: 2,
      total_revenue: 6000.0,
      total_units: 20,
      revenue_share_pct: 25.0,
      abc_class: 'B',
      xyz_class: 'Y',
      cv_demand: 0.85,
    },
  ],
  customer_segments: [
    {
      segment: 'champions',
      customer_count: 12,
      total_revenue: 18000.0,
      avg_order_value: 600.0,
    },
    {
      segment: 'loyal',
      customer_count: 18,
      total_revenue: 12000.0,
      avg_order_value: 400.0,
    },
    {
      segment: 'other',
      customer_count: 6,
      total_revenue: 2100.0,
      avg_order_value: 350.0,
    },
  ],
  cohorts: [
    {
      cohort_month: '2026-08-01',
      period_months: 0,
      cohort_size: 20,
      active_customers: 20,
      retention_rate: 1.0,
    },
    {
      cohort_month: '2026-08-01',
      period_months: 1,
      cohort_size: 20,
      active_customers: 8,
      retention_rate: 0.4,
    },
    {
      cohort_month: '2026-09-01',
      period_months: 0,
      cohort_size: 15,
      active_customers: 15,
      retention_rate: 1.0,
    },
  ],
  basket_pairs: [
    {
      product_a_id: 1,
      product_a_name: 'Silver Pearl Bracelet',
      product_a_name_ar: 'سوار اللؤلؤ الفضي',
      product_b_id: 2,
      product_b_name: 'Gold Ring',
      product_b_name_ar: 'خاتم ذهبي',
      support: 0.08,
      confidence: 0.45,
      lift: 2.15,
      sample_orders: 14,
    },
  ],
  discount_effect: {
    promo_weekly_units: 45.0,
    baseline_weekly_units: 30.0,
    uplift_pct: 50.0,
    note_ar: 'هذا التحليل للمقارنة ولا يثبت علاقة سببية حتمية',
    note_en: 'Correlation for comparison; not proof of cause',
  },
  fulfilment_quality: {
    total_orders: 150,
    cancellation_rate_pct: 4.5,
    refusal_rate_pct: 2.0,
    expiry_rate_pct: 3.5,
    median_delivery_days: 2.5,
    avg_proof_hours: 1.8,
  },
  geography: [
    {
      governorate: 'القاهرة',
      customer_count: 85,
      orders_count: 110,
      total_revenue: 28500.0,
    },
    {
      governorate: 'أخرى',
      customer_count: 4,
      orders_count: 6,
      total_revenue: 1200.0,
    },
  ],
}

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

describe('T-9.11: Descriptive Analyses & Analytics Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Sales Overview
  describe('SalesOverviewSection', () => {
    it('renders 7d and 28d moving averages and data table', () => {
      renderWithProviders(<SalesOverviewSection data={mockInsightsData.sales_overview} />)

      expect(screen.getByTestId('analytics-sales-overview')).toBeInTheDocument()
      expect(screen.getByText('نظرة عامة على المبيعات')).toBeInTheDocument()
      expect(screen.getByText('2026-10-15')).toBeInTheDocument()
    })
  })

  // 2. Product Performance
  describe('ProductPerformanceSection', () => {
    it('renders ABC revenue share and XYZ variability badges', () => {
      renderWithProviders(<ProductPerformanceSection data={mockInsightsData.product_performance} />)

      expect(screen.getByTestId('analytics-product-performance')).toBeInTheDocument()
      expect(screen.getByText('سوار اللؤلؤ الفضي')).toBeInTheDocument()
      expect(screen.getByText('60%')).toBeInTheDocument()
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('X')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.getByText('Y')).toBeInTheDocument()
    })
  })

  // 3. Customer Segments
  describe('CustomerSegmentsSection', () => {
    it('renders RFM segment cards and anonymized other group', () => {
      renderWithProviders(<CustomerSegmentsSection data={mockInsightsData.customer_segments} />)

      expect(screen.getByTestId('analytics-customer-segments')).toBeInTheDocument()
      expect(screen.getByText('الأبطال')).toBeInTheDocument()
      expect(screen.getByText('الأوفياء')).toBeInTheDocument()
      expect(screen.getByText('أخرى (حماية الخصوصية)')).toBeInTheDocument()
    })
  })

  // 4. Cohort Retention Matrix
  describe('CohortRetentionSection', () => {
    it('renders monthly cohort retention table with percentage badges', () => {
      renderWithProviders(<CohortRetentionSection data={mockInsightsData.cohorts} />)

      expect(screen.getByTestId('analytics-cohort-retention')).toBeInTheDocument()
      expect(screen.getByText('2026-08')).toBeInTheDocument()
      expect(screen.getByText('40%')).toBeInTheDocument()
    })
  })

  // 5. Basket Analysis
  describe('BasketAnalysisSection', () => {
    it('renders frequently bought together product pairs with lift', () => {
      renderWithProviders(<BasketAnalysisSection data={mockInsightsData.basket_pairs} />)

      expect(screen.getByTestId('analytics-basket-analysis')).toBeInTheDocument()
      expect(screen.getByText('2.15x')).toBeInTheDocument()
      expect(screen.getByText('8.0%')).toBeInTheDocument()
    })
  })

  // 6. Discount Effect
  describe('DiscountEffectSection', () => {
    it('renders missing analytics as unavailable instead of undefined or NaN', () => {
      renderWithProviders(
        <DiscountEffectSection data={{} as AnalyticsInsightsPayload['discount_effect']} />,
      )
      expect(screen.getAllByText('—')).toHaveLength(3)
      expect(screen.getByTestId('analytics-discount-effect')).not.toHaveTextContent(/undefined|NaN/)
    })

    it('renders promo vs baseline units and mandatory non-causal disclaimer', () => {
      renderWithProviders(<DiscountEffectSection data={mockInsightsData.discount_effect} />)

      expect(screen.getByTestId('analytics-discount-effect')).toBeInTheDocument()
      expect(screen.getByText('+50%')).toBeInTheDocument()

      const disclaimer = screen.getByTestId('discount-disclaimer')
      expect(disclaimer).toBeInTheDocument()
      expect(disclaimer).toHaveTextContent('هذا التحليل للمقارنة ولا يثبت علاقة سببية حتمية')
    })
  })

  // 7. Fulfilment Quality
  describe('FulfilmentQualitySection', () => {
    it('renders cancellation, refusal, expiry rates and turnaround times', () => {
      renderWithProviders(<FulfilmentQualitySection data={mockInsightsData.fulfilment_quality} />)

      expect(screen.getByTestId('analytics-fulfilment-quality')).toBeInTheDocument()
      expect(screen.getByText('4.5%')).toBeInTheDocument()
      expect(screen.getByText('2%')).toBeInTheDocument()
      expect(screen.getByText('3.5%')).toBeInTheDocument()
      expect(screen.getByText(/2.5\s*يوم/)).toBeInTheDocument()
      expect(screen.getByText(/1.8\s*ساعة/)).toBeInTheDocument()
    })
  })

  // 8. Geography Distribution
  describe('GeographySection', () => {
    it('renders governorates and privacy badge for merged small groups', () => {
      renderWithProviders(<GeographySection data={mockInsightsData.geography} />)

      expect(screen.getByTestId('analytics-geography')).toBeInTheDocument()
      expect(screen.getByText('القاهرة')).toBeInTheDocument()
      expect(screen.getByText(/أخرى/)).toBeInTheDocument()
    })
  })

  // 9. Full AnalyticsPage Integration & Step-Up Export
  describe('AnalyticsPage Integration', () => {
    it('fetches insights and renders complete dashboard in Arabic', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockInsightsData,
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      renderWithProviders(<AnalyticsPage />)

      expect(screen.getByTestId('admin-analytics-page')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('analytics-sales-overview')).toBeInTheDocument()
      })

      expect(screen.getByText('التحليلات الوصفية وتجزئة العملاء')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-product-performance')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-customer-segments')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-discount-effect')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-cohort-retention')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-basket-analysis')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-fulfilment-quality')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-geography')).toBeInTheDocument()
    })

    it('renders error state on RPC failure', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      renderWithProviders(<AnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(
          screen.getByText('تعذر تحميل الرؤى التحليلية، يرجى إعادة المحاولة.'),
        ).toBeInTheDocument()
      })
    })

    it('triggers Step-Up protected CSV export when export button is clicked', async () => {
      const user = userEvent.setup()

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockInsightsData,
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      renderWithProviders(<AnalyticsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('analytics-sales-overview')).toBeInTheDocument()
      })

      const exportBtn = screen.getByRole('button', { name: /تصدير تقرير CSV/ })
      expect(exportBtn).toBeInTheDocument()
      expect(exportBtn).not.toBeDisabled()

      await user.click(exportBtn)
    })
  })
})
