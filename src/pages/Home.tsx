import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SessionCard from '../components/SessionCard'
import { fetchUpcomingSessions, formatSessionTime, type SessionListItem } from '../lib/sessions'

const STEPS = [
  {
    title: 'Pick a session',
    body: 'Each month has a section and a guest teacher. Choose the one that fits what you want to learn.',
  },
  {
    title: 'Pay for the month',
    body: 'One payment gives you access to that session, its materials, and its chat until the month ends.',
  },
  {
    title: 'Join live and keep learning',
    body: 'Join the Zoom session at the time shown, then work through the classwork and tests in your room.',
  },
]

export default function Home() {
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    fetchUpcomingSessions()
      .then((rows) => {
        if (!ignore) setSessions(rows)
      })
      .catch((e) => {
        if (!ignore) setError(e.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  const next = sessions?.[0] ?? null
  const nextWhen = next ? formatSessionTime(next.starts_at) : null

  return (
    <>
      <section className="container-page grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-2">
        <div>
          <span className="pill">Live sessions, every month</span>
          <h1 className="mt-6 text-4xl leading-[1.08] sm:text-6xl">
            Learn design and tech from a working expert, every month.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-muted">
            Each session is taught live by a guest practitioner. Join on Zoom, ask questions in the
            chat, and work through the classwork that comes with it.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/sessions" className="btn-primary">Browse this month</Link>
            <Link to="/login" className="btn-ghost">Create an account</Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-accent p-8 sm:p-12">
          <img src="/logo.svg" alt="" aria-hidden className="absolute -right-12 -top-12 h-56 w-56 opacity-15" />
          <div className="card relative mx-auto max-w-sm p-6 sm:p-7">
            {next && nextWhen ? (
              <>
                <p className="eyebrow">Next session</p>
                <h2 className="mt-4 text-2xl leading-snug">{next.title}</h2>
                <p className="mt-3 text-sm text-brand-muted">
                  {nextWhen.day}, {nextWhen.time}
                  {next.guest_teachers && <> · with {next.guest_teachers.name}</>}
                </p>
                <Link to={`/sessions/${next.id}`} className="btn-primary mt-7 w-full">
                  View session
                </Link>
              </>
            ) : (
              <>
                <p className="eyebrow">Next session</p>
                <p className="mt-4 text-brand-muted">
                  The next session will appear here once it's published.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">This month</p>
            <h2 className="mt-3 text-3xl">Upcoming sessions</h2>
          </div>
          <Link to="/sessions" className="text-sm text-brand-muted transition hover:text-brand-primary">
            View all
          </Link>
        </div>

        {error && <p className="mt-10 text-sm text-brand-error">Sessions could not be loaded. Please refresh.</p>}
        {sessions === null && !error && <p className="mt-10 text-brand-muted">Loading sessions</p>}
        {sessions !== null && sessions.length === 0 && (
          <div className="card mt-10 text-brand-muted">
            No sessions are scheduled yet. New sessions appear here once they're published.
          </div>
        )}
        {sessions !== null && sessions.length > 0 && (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sessions.slice(0, 6).map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-brand-border bg-brand-surface">
        <div className="container-page py-20">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-3xl">Three steps to your first session</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="card shadow-none">
                <span className="font-serif text-4xl text-brand-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-5 text-xl">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-brand-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}