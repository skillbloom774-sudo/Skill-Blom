import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { teacherPhotoUrl } from '../lib/sessions'
import PageHeader from '../components/PageHeader'

type Row = {
  id: string
  name: string
  bio: string | null
  photo_path: string | null
  upcoming_count: number
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Teachers() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    supabase.rpc('teacher_directory').then(({ data, error }) => {
      if (ignore) return
      if (error) {
        setError(error.message)
        return
      }
      setRows((data as Row[]) ?? [])
    })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <section className="container-page py-14 sm:py-20">
      <PageHeader
        eyebrow="Teachers"
        title="Meet your guest teachers"
        description="Every teacher below has a session coming up. Open a profile to see their work and upcoming sessions."
      />

      {error && <p className="mt-10 text-sm text-brand-error">Teachers could not be loaded. Please refresh.</p>}
      {rows === null && !error && <p className="mt-10 text-brand-muted">Loading teachers</p>}

      {rows !== null && rows.length === 0 && (
        <div className="card mt-10 text-center">
          <h2 className="text-2xl">No teachers scheduled yet</h2>
          <p className="mt-3 text-brand-muted">New teachers appear here once they have a session coming up.</p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => {
            const photo = teacherPhotoUrl(t.photo_path)
            return (
              <Link
                key={t.id}
                to={`/teachers/${t.id}`}
                className="card flex flex-col gap-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-center gap-4">
                  {photo ? (
                    <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary font-serif text-lg text-white">
                      {initials(t.name)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-lg font-medium text-brand-text">{t.name}</p>
                    <p className="mt-1 text-sm text-brand-muted">
                      {t.upcoming_count} upcoming {t.upcoming_count === 1 ? 'session' : 'sessions'}
                    </p>
                  </div>
                </div>
                {t.bio && <p className="line-clamp-3 text-sm leading-relaxed text-brand-muted">{t.bio}</p>}
                <span className="mt-auto text-sm font-medium text-brand-primary">View profile →</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}