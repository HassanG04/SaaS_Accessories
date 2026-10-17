import type { ShippingAddressForm, PlaceOrderShippingPayload } from './types'

/**
 * Normalizes an Egyptian phone number:
 * - Converts Arabic-Indic numerals (٠-٩) to standard ASCII digits (0-9).
 * - Strips whitespace, dashes, dots, and parentheses.
 * - Handles Egyptian country codes (+20, 0020, 20).
 * - Ensures a leading 0 if 10 digits starting with 10, 11, 12, 15 are entered.
 */
export function normalizeEgyptianPhone(input: string): string {
  if (!input) return ''

  const arabicIndic = '٠١٢٣٤٥٦٧٨٩'
  let normalized = input.replace(/[٠-٩]/g, (char) => {
    const idx = arabicIndic.indexOf(char)
    return idx >= 0 ? String(idx) : char
  })

  // Remove spaces, dashes, dots, brackets
  normalized = normalized.trim().replace(/[\s\-().]/g, '')

  // Remove international prefixes
  if (normalized.startsWith('+20')) {
    normalized = normalized.slice(3)
  } else if (normalized.startsWith('0020')) {
    normalized = normalized.slice(4)
  } else if (normalized.startsWith('+2')) {
    normalized = normalized.slice(2)
  } else if (normalized.startsWith('20') && normalized.length === 12) {
    normalized = normalized.slice(2)
  }

  // If 10 digits given without leading 0 (e.g. 10xxxxxxxx -> 010xxxxxxxx)
  if (normalized.length === 10 && /^[1][0125]/.test(normalized)) {
    normalized = '0' + normalized
  }

  return normalized
}

/**
 * Checks if a normalized string is a valid Egyptian mobile phone number.
 * Must be exactly 11 digits starting with 010, 011, 012, or 015.
 */
export function isValidEgyptianPhone(phone: string): boolean {
  const normalized = normalizeEgyptianPhone(phone)
  return /^01[0125]\d{8}$/.test(normalized)
}

/**
 * Normalizes a postal code:
 * - Converts Arabic-Indic numerals (٠-٩) to standard ASCII digits (0-9).
 * - Strips whitespace and dashes.
 * - Preserves leading zeros (e.g. '01234').
 */
export function normalizePostalCode(input: string): string {
  if (!input) return ''
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩'
  const normalized = input.replace(/[٠-٩]/g, (char) => {
    const idx = arabicIndic.indexOf(char)
    return idx >= 0 ? String(idx) : char
  })
  return normalized.trim().replace(/[\s-]/g, '')
}

/**
 * Checks if a string is a valid Egyptian postal code.
 * Must be exactly 5 numeric digits, preserving any leading zeros.
 */
export function isValidPostalCode(code: string): boolean {
  const normalized = normalizePostalCode(code)
  return /^\d{5}$/.test(normalized)
}

export interface ValidationErrors {
  name?: string
  phone?: string
  alt_phone?: string
  governorate_id?: string
  address?: string
  postal_code?: string
  city?: string
  district?: string
  floor?: string
  apartment?: string
  landmark?: string
  notes?: string
  delivery_method?: string
  payment_method?: string
}

/**
 * Validates shipping address form values and returns validation errors.
 */
export function validateShippingForm(
  form: ShippingAddressForm,
  options?: { isDeliveryMethodSelected?: boolean; isPaymentMethodSelected?: boolean },
): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {}

  // Name (required, 1..100)
  const trimmedName = form.name.trim()
  if (!trimmedName) {
    errors.name = 'الاسم الكامل مطلوب'
  } else if (trimmedName.length > 100) {
    errors.name = 'الاسم يجب ألا يتجاوز 100 حرف'
  }

  // Primary Phone (required, valid Egyptian mobile)
  const trimmedPhone = form.phone.trim()
  if (!trimmedPhone) {
    errors.phone = 'رقم الموبايل مطلوب'
  } else if (!isValidEgyptianPhone(trimmedPhone)) {
    errors.phone = 'رقم الموبايل غير صحيح (يجب أن يبدأ بـ 01 ويتكون من 11 رقمًا)'
  }

  // Alt Phone (optional, if given must be valid and distinct from phone)
  const trimmedAltPhone = form.alt_phone.trim()
  if (trimmedAltPhone) {
    if (!isValidEgyptianPhone(trimmedAltPhone)) {
      errors.alt_phone = 'رقم الموبايل الإضافي غير صحيح (يجب أن يبدأ بـ 01 ويتكون من 11 رقمًا)'
    } else if (normalizeEgyptianPhone(trimmedAltPhone) === normalizeEgyptianPhone(trimmedPhone)) {
      errors.alt_phone = 'رقم الموبايل الإضافي يجب أن يكون مختلفًا عن رقم الموبايل الأساسي'
    } else if (trimmedAltPhone.length > 20) {
      errors.alt_phone = 'الرقم الإضافي يجب ألا يتجاوز 20 حرفًا'
    }
  }

  // Governorate (required)
  if (!form.governorate_id || Number(form.governorate_id) <= 0) {
    errors.governorate_id = 'يرجى اختيار المحافظة'
  }

  // Street Address (required, 1..150)
  const trimmedAddress = form.address.trim()
  if (!trimmedAddress) {
    errors.address = 'الشارع ورقم المبنى مطلوب'
  } else if (trimmedAddress.length > 150) {
    errors.address = 'العنوان يجب ألا يتجاوز 150 حرفًا'
  }

  // Postal Code (required, exactly 5 digits, preserves leading zeros)
  const normPostal = normalizePostalCode(form.postal_code || '')
  if (!normPostal) {
    errors.postal_code = 'الرمز البريدي مطلوب'
  } else if (!/^\d{5}$/.test(normPostal)) {
    errors.postal_code = 'الرمز البريدي غير صحيح (يجب أن يتكون من 5 أرقام)'
  }

  // City (optional, max 150)
  if (form.city.trim().length > 150) {
    errors.city = 'اسم المدينة أو المركز يجب ألا يتجاوز 150 حرفًا'
  }

  // District (optional, max 150)
  if (form.district.trim().length > 150) {
    errors.district = 'اسم الحي أو المنطقة يجب ألا يتجاوز 150 حرفًا'
  }

  // Floor (optional, max 50)
  if (form.floor.trim().length > 50) {
    errors.floor = 'الدور يجب ألا يتجاوز 50 حرفًا'
  }

  // Apartment (optional, max 50)
  if (form.apartment.trim().length > 50) {
    errors.apartment = 'رقم الشقة يجب ألا يتجاوز 50 حرفًا'
  }

  // Landmark (optional, max 150)
  if (form.landmark.trim().length > 150) {
    errors.landmark = 'العلامة المميزة يجب ألا تتجاوز 150 حرفًا'
  }

  // Notes (optional, max 500)
  if (form.notes.trim().length > 500) {
    errors.notes = 'ملاحظات التوصيل يجب ألا تتجاوز 500 حرف'
  }

  if (options?.isDeliveryMethodSelected === false) {
    errors.delivery_method = 'يرجى تحديد طريقة التوصيل'
  }

  if (options?.isPaymentMethodSelected === false) {
    errors.payment_method = 'يرجى تحديد طريقة الدفع'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Transforms validated form state into the normalized payload expected by the database place_order RPC.
 */
export function buildPlaceOrderShippingPayload(
  form: ShippingAddressForm,
): PlaceOrderShippingPayload {
  const normPhone = normalizeEgyptianPhone(form.phone)
  const normAltPhone = form.alt_phone.trim() ? normalizeEgyptianPhone(form.alt_phone) : null
  const normPostal = normalizePostalCode(form.postal_code || '')

  return {
    name: form.name.trim(),
    phone: normPhone,
    alt_phone: normAltPhone || null,
    governorate_id: Number(form.governorate_id),
    city: form.city.trim() || null,
    district: form.district.trim() || null,
    address: form.address.trim(),
    postal_code: normPostal,
    floor: form.floor.trim() || null,
    apartment: form.apartment.trim() || null,
    landmark: form.landmark.trim() || null,
    notes: form.notes.trim() || null,
  }
}
