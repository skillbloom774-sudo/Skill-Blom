import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

export default function TeacherRoute({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth()

  if (loading) return <p className="container-page py-16 text-brand-muted">Loading</p>
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'guest_teacher' && role !== 'admin') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}