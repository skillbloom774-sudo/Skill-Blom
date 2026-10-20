import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type Role = 'student' | 'guest_teacher' | 'admin'

export type AuthState = {
  user: User | null
  role: Role | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}