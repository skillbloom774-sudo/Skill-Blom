import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatNaira, formatSessionTime, teacherPhotoUrl } from '../lib/sessions'

type SessionItem = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  price_kobo: number
  section_name: string
}

type Profile = {
  id: string
  name: string
  bio: string | null
  photo_path: string | null
  upcoming: SessionItem[]
  past: SessionItem[]
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

function SessionLine({ s, ended }: { s: SessionItem; ended: boolean }) {
  const when = formatSessionTime(s.starts_at)

  return (
    <Link
      to={`/sessions/${s.id}`}
      className="card flex flex-col gap-3 transition hover:border-brand-primary sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="eyebrow">{s.section_name}</p>
        <p className="mt-2 text-lg font-medium text-brand-text">{s.title}</p>
        <p className="mt-1 text-sm text-brand-muted">
          {when.day}, {when.time}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="font-serif text-lg text-brand-primary">{formatNaira(s.price_kobo)}</span>
        {ended && <span className="pill bg-brand-border/60 text-brand-muted">Ended</span>}
      </div>
    </Link>
  )
}

export default function TeacherProfile() {
  const { id } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!id) return
    let ignore = false

    supabase.rpc('teacher_profile', { p_teacher_id: id }).then(({ data, error }) => {
      if (ignore) return
      if (error || !data) {
        setStatus('missing')
        return
      }
      setProfile(data as Profile)
      setStatus('ready')
    })

    return () => {
      ignore = true
    }
  }, [id])

  if (status === 'loading') {
    return <p className="container-page py-16 text-brand-muted">Loading profile</p>
  }

  if (status === 'missing' || !profile) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">This teacher isn't available</h1>
        <p className="mt-4 text-brand-muted">They may not have a published profile yet.</p>
        <Link to="/teachers" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to all teachers
        </Link>
      </section>
    )
  }

  const photo = teacherPhotoUrl(profile.photo_path)

  return (
    <section className="container-page py-12 sm:py-16">
      <Link to="/teachers" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← All teachers
      </Link>

      <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-start">
        {photo ? (
          <img src={photo} alt={profile.name} className="h-32 w-32 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-brand-primary font-serif text-3xl text-white">
            {initials(profile.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="eyebrow">Guest teacher</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{profile.name}</h1>
          {profile.bio && (
            <p className="mt-5 max-w-prose whitespace-pre-line text-lg leading-relaxed text-brand-text">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-2xl">Upcoming sessions</h2>
        {profile.upcoming.length === 0 ? (
          <p className="mt-4 text-brand-muted">No upcoming sessions right now.</p>
        ) : (
          <div className="mt-6 grid gap-4">
            {profile.upcoming.map((s) => (
              <SessionLine key={s.id} s={s} ended={false} />
            ))}
          </div>
        )}
      </div>

      {profile.past.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl">Past sessions</h2>
          <div className="mt-6 grid gap-4">
            {profile.past.map((s) => (
              <SessionLine key={s.id} s={s} ended />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}