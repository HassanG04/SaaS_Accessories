import type {
  OrderStatus,
  PaymentStatus,
  DeliveryMethod,
  PaymentMethod,
} from '@/features/orders/types'

export interface AdminOrderItemProduct {
  image_url: string | null
  name: string
  name_ar: string | null
}

export interface AdminOrderItem {
  id: number
  order_id: number
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  products?: AdminOrderItemProduct | null
}

export interface AdminOrder {
  id: number
  user_id: string
  created_at: string
  updated_at: string
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  delivery_method: DeliveryMethod
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
  tracking_number: string | null
  rep_name: string | null
  rep_phone: string | null
  payment_reference: string | null
  payment_proof_path: string | null
  payment_deadline: string | null
  payment_submitted_at: string | null
  paid_at: string | null
  payment_review_note: string | null
  order_items: AdminOrderItem[]
}

export interface AdminOrderFilters {
  search: string
  status: 'all' | OrderStatus
  payment_status: 'all' | PaymentStatus
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus
  tracking_number?: string | null
  rep_name?: string | null
  rep_phone?: string | null
}

export interface UpdateFulfillmentPayload {
  tracking_number?: string | null
  rep_name?: string | null
  rep_phone?: string | null
}
