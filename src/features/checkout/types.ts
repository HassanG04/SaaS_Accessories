import type { Database } from '@/types/database.types'

export type DeliveryMethod = Database['public']['Enums']['delivery_method']
export type PaymentMethod = Database['public']['Enums']['payment_method']

export interface ShippingAddressForm {
  name: string
  phone: string
  alt_phone: string
  governorate_id: number | ''
  city: string
  district: string
  address: string
  postal_code: string
  floor: string
  apartment: string
  landmark: string
  notes: string
}

export type PlaceOrderShippingPayload = {
  name: string
  phone: string
  alt_phone?: string | null
  governorate_id: number
  city?: string | null
  district?: string | null
  address: string
  postal_code: string
  floor?: string | null
  apartment?: string | null
  landmark?: string | null
  notes?: string | null
}

export type PlaceOrderItemPayload = {
  product_id: number
  quantity: number
}

export interface PlaceOrderParams {
  items: PlaceOrderItemPayload[]
  delivery_method: DeliveryMethod
  payment_method: PaymentMethod
  ship: PlaceOrderShippingPayload
  save_address?: boolean
}
