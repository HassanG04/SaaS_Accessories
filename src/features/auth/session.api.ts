import { supabase } from '../../lib/supabase'
import type { AalLevel, MfaFactor, UserProfile } from './types'

type ApiDelegate = {
  fetchProfileApi?: (userId: string) => Promise<UserProfile | null>
  fetchAalApi?: () => Promise<AalLevel>
  fetchFactorsApi?: () => Promise<MfaFactor[]>
  signOutApi?: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<void>
}

let apiDelegate: ApiDelegate | null = null

export function setApiDelegate(delegate: ApiDelegate) {
  apiDelegate = delegate
}

const isMocked = (fn?: unknown): boolean => Boolean((fn as { mock?: unknown })?.mock)

export async function signOutApi(options?: {
  scope?: 'global' | 'local' | 'others'
}): Promise<void> {
  const delegate = apiDelegate?.signOutApi
  if (isMocked(delegate) && delegate) return delegate(options)
  await supabase.auth.signOut(options)
}

export async function fetchProfileApi(userId: string): Promise<UserProfile | null> {
  const delegate = apiDelegate?.fetchProfileApi
  if (isMocked(delegate) && delegate) return delegate(userId)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id,role,full_name,phone,alt_phone,governorate_id,city,district,address,postal_code,floor,apartment,landmark,email',
      )
      .eq('id', userId)
      .maybeSingle()

    return error || !data
      ? null
      : ({ ...data, role: (data.role as 'admin' | 'customer') || 'customer' } as UserProfile)
  } catch {
    return null
  }
}

export async function fetchAalApi(): Promise<AalLevel> {
  const delegate = apiDelegate?.fetchAalApi
  if (isMocked(delegate) && delegate) return delegate()
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return !error && data?.currentLevel === 'aal2' ? 'aal2' : 'aal1'
  } catch {
    return 'aal1'
  }
}

export async function fetchFactorsApi(): Promise<MfaFactor[]> {
  const delegate = apiDelegate?.fetchFactorsApi
  if (isMocked(delegate) && delegate) return delegate()
  try {
    const { data, error } = await supabase.auth.mfa.listFactors()
    return error || !data
      ? []
      : (data.totp || []).map((f) => ({
          ...f,
          factor_type: 'totp' as const,
          status: f.status as 'verified' | 'unverified',
        }))
  } catch {
    return []
  }
}
