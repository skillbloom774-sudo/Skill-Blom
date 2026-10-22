import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { formatSessionTime } from '../../lib/sessions'

type Row = {
  id: string
  title: string
  starts_at: string
  status: string
  sections: { name: string } | null
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [name, setName] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Row[] | null>(null)

  useEffect(() => {
    if (!user) return
    let ignore = false

    supabase
      .from('guest_teachers')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data: teacher }) => {
        if (ignore) return
        if (!teacher) {
          setSessions([])
          return
        }
        setName(teacher.name)
        const { data } = await supabase
          .from('sessions')
          .select('id, title, starts_at, status, sections(name)')
          .eq('guest_teacher_id', teacher.id)
          .neq('status', 'cancelled')
          .order('starts_at')
        if (!ignore) setSessions((data as unknown as Row[]) ?? [])
      })

    return () => {
      ignore = true
    }
  }, [user])

  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Teaching</p>
      <h1 className="mt-3 text-4xl">{name ? `Welcome, ${name}` : 'Your sessions'}</h1>

      {sessions === null && <p className="mt-10 text-sm text-brand-muted">Loading sessions</p>}

      {sessions !== null && sessions.length === 0 && (
        <div className="card mt-10 text-brand-muted">
          No sessions are assigned to you yet. The admin will add you to a session.
        </div>
      )}

      <div className="mt-10 grid gap-4">
        {sessions?.map((s) => {
          const when = formatSessionTime(s.starts_at)
          return (
            <div
              key={s.id}
              className="card flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="eyebrow">{s.sections?.name}</p>
                <p className="mt-2 text-lg font-medium text-brand-text">{s.title}</p>
                <p className="mt-1 text-sm text-brand-muted">
                  {when.day}, {when.time} · {s.status}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link to={`/teacher/sessions/${s.id}/attendance`} className="btn-ghost px-4 py-2 text-sm">
                  Attendance
                </Link>
                <Link to={`/teacher/sessions/${s.id}/chat`} className="btn-ghost px-4 py-2 text-sm">
                  Chat
                </Link>
                <Link to={`/teacher/sessions/${s.id}/marking`} className="btn-ghost px-4 py-2 text-sm">
                  Marking
                </Link>
                <Link to={`/teacher/sessions/${s.id}`} className="btn-primary px-4 py-2 text-sm">
                  Manage
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}