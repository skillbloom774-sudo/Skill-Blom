import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BuyButton from '../components/BuyButton'
import ShareButton from '../components/ShareButton'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import {
  fetchSession,
  formatNaira,
  formatSessionTime,
  teacherPhotoUrl,
  type SessionListItem,
} from '../lib/sessions'

const INCLUDED = [
  'Live session on Zoom or Google Meet, joined from your session room',
  'Classwork, assignments and tests from your guest teacher',
  'A chat with your class, plus a private line to your teacher',
  'A digital access card you can show, download, or verify',
  'Email reminders 24 hours and 15 minutes before the session',
]

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function durationLabel(startIso: string, endIso: string) {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h} hr ${m} min`
  if (h) return `${h} ${h === 1 ? 'hour' : 'hours'}`
  return `${m} min`
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-brand-accent pl-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-brand-text">{value}</p>
    </div>
  )
}

export default function SessionDetail() {
  const { id } = useParams()
  const { role, loading: authLoading } = useAuth()
  const [session, setSession] = useState<SessionListItem | null>(null)
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    fetchSession(id)
      .then((s) => {
        if (cancelled) return
        setSession(s)
        setStatus(s ? 'ready' : 'missing')
      })
      .catch(() => {
        if (!cancelled) setStatus('missing')
      })

    supabase
      .from('sessions')
      .select('guest_teacher_id')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setTeacherId(data?.guest_teacher_id ?? null)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (status === 'loading' && id) {
    return <p className="container-page py-16 text-brand-muted">Loading session</p>
  }

  if (!id || status === 'missing' || !session) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">This session isn't available</h1>
        <p className="mt-4 text-brand-muted">It may have ended or may not be published yet.</p>
        <Link to="/sessions" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to all sessions
        </Link>
      </section>
    )
  }

  const start = new Date(session.starts_at)
  const when = formatSessionTime(session.starts_at)
  const month = new Intl.DateTimeFormat('en-NG', { month: 'short', timeZone: 'Africa/Lagos' }).format(start)
  const day = new Intl.DateTimeFormat('en-NG', { day: 'numeric', timeZone: 'Africa/Lagos' }).format(start)

  const teacher = session.guest_teachers
  const photo = teacherPhotoUrl(teacher?.photo_path ?? null)
  const isGuestTeacher = role === 'guest_teacher'
  const isAdmin = role === 'admin'

  return (
    <section className="container-page py-12 sm:py-16">
      <Link to="/sessions" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← All sessions
      </Link>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div className="min-w-0">
          <span className="pill">{session.sections?.name}</span>
          <h1 className="mt-5 text-4xl leading-[1.1] sm:text-5xl">{session.title}</h1>

          <div className="mt-5">
            <ShareButton sessionId={session.id} title={session.title} />
          </div>

          <p className="mt-6 text-lg text-brand-muted">
            {when.day}, {when.time} · {durationLabel(session.starts_at, session.ends_at)}
          </p>

          {session.description && (
            <p className="mt-8 whitespace-pre-line text-lg leading-relaxed text-brand-text">
              {session.description}
            </p>
          )}

          <div className="card mt-12">
            <p className="eyebrow">What you get</p>
            <ul className="mt-5 grid gap-4">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-brand-text">
                  <CheckIcon />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {teacher && (
            <div className="mt-12">
              <p className="eyebrow">Your guest teacher</p>
              <div className="card mt-5 flex items-start gap-5">
                {photo ? (
                  <img src={photo} alt={teacher.name} className="h-16 w-16 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary font-serif text-lg text-white">
                    {initials(teacher.name)}
                  </span>
                )}
                <div className="min-w-0">
                  {teacherId ? (
                    <Link
                      to={`/teachers/${teacherId}`}
                      className="text-lg font-medium text-brand-text transition hover:text-brand-primary"
                    >
                      {teacher.name}
                    </Link>
                  ) : (
                    <p className="text-lg font-medium text-brand-text">{teacher.name}</p>
                  )}
                  {teacher.bio && (
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-brand-muted">{teacher.bio}</p>
                  )}
                  {teacherId && (
                    <Link
                      to={`/teachers/${teacherId}`}
                      className="mt-3 inline-block text-sm font-medium text-brand-primary hover:underline"
                    >
                      View their profile and other sessions →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            <Fact label="Format" value="Live online on Zoom or Google Meet" />
            <Fact label="Access" value="Until the end of the session month" />
            <Fact label="Refunds" value="You can request a refund any time before the session starts" />
            <Fact label="Reminders" value="By email, 24 hours and 15 minutes before it starts" />
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-7">
            <div className="flex items-start gap-4">
              <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-brand-primary-soft py-3 text-brand-primary">
                <span className="text-xs font-semibold uppercase tracking-wider">{month}</span>
                <span className="mt-0.5 font-serif text-2xl leading-none">{day}</span>
              </div>
              <div>
                <p className="text-sm text-brand-muted">{when.day}</p>
                <p className="mt-1 font-medium text-brand-text">{when.time}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-brand-border pt-6">
              <p className="text-sm text-brand-muted">Price for this month</p>
              <p className="mt-1 font-serif text-4xl text-brand-primary">{formatNaira(session.price_kobo)}</p>
            </div>

            <div className="mt-6 border-t border-brand-border pt-6">
              {authLoading ? null : isGuestTeacher ? (
                <div className="rounded-xl bg-brand-primary-soft p-5">
                  <p className="font-medium text-brand-text">Guest teachers don't buy sessions.</p>
                  <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                    Manage your classes, materials, and marking from your teaching area.
                  </p>
                  <Link to="/teacher" className="btn-primary mt-5 w-full">
                    Go to teaching
                  </Link>
                </div>
              ) : isAdmin ? (
                <div className="rounded-xl bg-brand-primary-soft p-5">
                  <p className="font-medium text-brand-text">You're viewing as an admin.</p>
                  <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                    Admins manage sessions and enter rooms without paying.
                  </p>
                  <div className="mt-5 grid gap-3">
                    <Link to={`/admin/sessions/${session.id}`} className="btn-ghost w-full">
                      Edit session
                    </Link>
                    <Link to={`/sessions/${session.id}/room`} className="btn-primary w-full">
                      Open session room
                    </Link>
                  </div>
                </div>
              ) : (
                <BuyButton sessionId={session.id} priceKobo={session.price_kobo} />
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-brand-muted">
            Questions about this session? Ask in the class chat after you join.
          </p>
        </aside>
      </div>
    </section>
  )
}