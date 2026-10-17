import type { Session, User } from '@supabase/supabase-js'

export type UserRole = 'customer' | 'admin'
export type AalLevel = 'aal1' | 'aal2'

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string | null
  phone: string | null
  alt_phone?: string | null
  governorate_id?: number | null
  city?: string | null
  district?: string | null
  address?: string | null
  postal_code?: string | null
  floor?: string | null
  apartment?: string | null
  landmark?: string | null
  email?: string | null
  created_at?: string
  updated_at?: string
}

export type AuthErrorCode =
  | 'AUTH-001'
  | 'AUTH-002'
  | 'AUTH-003'
  | 'AUTH-004'
  | 'AUTH-005'
  | 'AUTH-006'
  | 'AUTH-007'
  | 'AUTH-008'
  | 'AUTH-009'
  | 'AUTH-010'
  | 'AUTH-011'
  | 'AUTH-012'
  | 'AUTH-013'
  | 'AUTH-014'
  | 'AUTH-016'
  | 'ADM-001'
  | 'ADM-002'
  | 'ADM-003'

export interface SignInCredentials {
  email: string
  password: string
  captchaToken?: string
}

export interface SignUpCredentials {
  email: string
  password: string
  fullName?: string
  captchaToken?: string
}

export interface ResetPasswordCredentials {
  email: string
  captchaToken?: string
}

export interface ResendConfirmationCredentials {
  email: string
  captchaToken?: string
}

export interface MfaFactor {
  id: string
  friendly_name?: string
  factor_type: 'totp'
  status: 'verified' | 'unverified'
  created_at?: string
  updated_at?: string
}

export interface MfaEnrollResult {
  id: string
  type: 'totp'
  totp: {
    qr_code: string
    secret: string
    uri: string
  }
}

export interface AuthActionResult {
  success: boolean
  code?: AuthErrorCode
  message?: string
}

export interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  role: UserRole
  aal: AalLevel
  factors: MfaFactor[]
  loading: boolean
  loadingFactors: boolean
  signIn: (credentials: SignInCredentials) => Promise<AuthActionResult>
  signUp: (credentials: SignUpCredentials) => Promise<AuthActionResult>
  resetPassword: (credentials: ResetPasswordCredentials) => Promise<AuthActionResult>
  resendConfirmation: (credentials: ResendConfirmationCredentials) => Promise<AuthActionResult>
  signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<void>
  refreshProfile: () => Promise<void>
  refreshAal: () => Promise<AalLevel>
  refreshFactors: () => Promise<MfaFactor[]>
  enrollTotp: (friendlyName?: string) => Promise<{ data?: MfaEnrollResult; error?: AuthErrorCode }>
  challengeAndVerify: (factorId: string, code: string) => Promise<AuthActionResult>
  unenrollFactor: (factorId: string) => Promise<AuthActionResult>
  updatePassword: (password: string) => Promise<AuthActionResult>
  updateEmail: (email: string) => Promise<AuthActionResult>
}
