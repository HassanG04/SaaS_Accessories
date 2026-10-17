import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { CustomerStats, UpdateProfileInput } from './types'

export async function getCustomerStatsApi(): Promise<CustomerStats> {
  const { data, error } = await supabase
    .from('customer_stats')
    .select('orders_count, total_spent, favorite_product_id, favorite_product_name')
    .maybeSingle()

  if (error) {
    throw toAppError(error)
  }

  return {
    orders_count: Number(data?.orders_count ?? 0),
    total_spent: Number(data?.total_spent ?? 0),
    favorite_product_id: data?.favorite_product_id ? Number(data.favorite_product_id) : null,
    favorite_product_name: data?.favorite_product_name ?? null,
  }
}

export async function updateProfileApi(userId: string, input: UpdateProfileInput): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone?.trim() || null,
      alt_phone: input.alt_phone?.trim() || null,
      governorate_id: input.governorate_id,
      city: input.city?.trim() || null,
      district: input.district?.trim() || null,
      address: input.address?.trim() || null,
      postal_code: input.postal_code?.trim() || null,
      floor: input.floor?.trim() || null,
      apartment: input.apartment?.trim() || null,
      landmark: input.landmark?.trim() || null,
    })
    .eq('id', userId)

  if (error) {
    throw toAppError(error)
  }
}
