export interface CustomerStats {
  orders_count: number
  total_spent: number
  favorite_product_id: number | null
  favorite_product_name: string | null
}

export interface UpdateProfileInput {
  full_name: string
  phone: string | null
  alt_phone: string | null
  governorate_id: number | null
  city: string | null
  district: string | null
  address: string | null
  postal_code: string | null
  floor: string | null
  apartment: string | null
  landmark: string | null
}

export interface ProfileFormState {
  full_name: string
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
}
