import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

// Counts one view per session per browser per day, so refreshing the page doesn't inflate the numbers.
// Admins and teachers aren't counted, so checking a session doesn't skew the figures.
export default function SessionViewTracker() {
  const { id } = useParams()
  const { role, loading } = useAuth()

  useEffect(() => {
    if (!id || loading) return
    if (role === 'admin' || role === 'guest_teacher') return

    const key = `viewed-${id}-${new Date().toDateString()}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    supabase.rpc('log_session_view', { p_session_id: id }).then(() => {
      // A failed count should never affect the page, so nothing is shown
    })
  }, [id, role, loading])

  return null
}