import type { Database } from '@/types/database.types'

export type OrderStatus = Database['public']['Enums']['order_status']
export type PaymentStatus = Database['public']['Enums']['payment_status']
export type DeliveryMethod = Database['public']['Enums']['delivery_method']
export type PaymentMethod = Database['public']['Enums']['payment_method']

export interface CustomerOrderItemProduct {
  image_url: string | null
  name: string
  name_ar: string | null
}

export interface CustomerOrderItem {
  id: number
  order_id: number
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  products?: CustomerOrderItemProduct | null
}

export interface CustomerOrder {
  id: number
  user_id: string
  created_at: string
  updated_at: string
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  delivery_method: DeliveryMethod
  tracking_number: string | null
  rep_name: string | null
  rep_phone: string | null
  subtotal: number
  shipping_fee: number
  total: number
  ship_name: string
  ship_phone: string
  ship_alt_phone: string | null
  ship_governorate: string
  ship_city: string | null
  ship_district: string | null
  ship_address: string
  ship_postal_code?: string | null
  ship_floor: string | null
  ship_apartment: string | null
  ship_landmark: string | null
  notes: string | null
  order_items: CustomerOrderItem[]
}

/**
 * An order can be cancelled by the customer ONLY when:
 * 1. Its status is 'pending'
 * 2. Its payment status is NOT 'under_review' (e.g. InstaPay orders under admin review cannot be cancelled)
 */
export function canCancelOrder(order: Pick<CustomerOrder, 'status' | 'payment_status'>): boolean {
  return order.status === 'pending' && order.payment_status !== 'under_review'
}
