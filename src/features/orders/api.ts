import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { CustomerOrder } from './types'

/**
 * Fetches the current customer's orders with itemized products and delivery details.
 */
export async function getMyOrdersApi(): Promise<CustomerOrder[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        user_id,
        created_at,
        updated_at,
        status,
        payment_status,
        payment_method,
        delivery_method,
        tracking_number,
        rep_name,
        rep_phone,
        subtotal,
        shipping_fee,
        total,
        ship_name,
        ship_phone,
        ship_alt_phone,
        ship_governorate,
        ship_city,
        ship_district,
        ship_address,
        ship_postal_code,
        ship_floor,
        ship_apartment,
        ship_landmark,
        notes,
        order_items (
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          products (
            image_url,
            name,
            name_ar
          )
        )
      `,
      )
      .order('created_at', { ascending: false })

    if (error) {
      throw toAppError(error)
    }

    return (data ?? []) as unknown as CustomerOrder[]
  } catch (err) {
    throw toAppError(err)
  }
}

/**
 * Cancels a pending customer order via database RPC `cancel_my_order`.
 * Restores product stock automatically through database trigger `orders_status_guard`.
 */
export async function cancelMyOrderApi(orderId: number): Promise<void> {
  try {
    const { error } = await supabase.rpc('cancel_my_order', {
      p_order_id: orderId,
    })

    if (error) {
      throw toAppError(error)
    }
  } catch (err) {
    throw toAppError(err)
  }
}
