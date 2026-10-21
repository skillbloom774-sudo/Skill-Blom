import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import {
  fetchMyPurchases,
  getPurchaseState,
  type Purchase,
  type PurchaseState,
} from '../lib/purchases'
import { supabase } from '../lib/supabase'
import { formatSessionTime } from '../lib/sessions'
import RefundRequestButton from '../components/RefundRequestButton'
import OnboardingChecklist from '../components/OnboardingChecklist'
import AddToCalendarButton from '../components/AddToCalendarButton'

type Tagged = { p: Purchase; s: PurchaseState }

type TeachRow = {
  id: string
  title: string
  starts_at: string
  status: 'draft' | 'published' | 'cancelled'
  sections: { name: string } | null
}

const STATE_LABEL: Record<PurchaseState, string> = {
  upcoming: 'Upcoming',
  live: 'Live now',
  ended: 'Ended',
  expired: 'Expired',
}

const STATE_CLASS: Record<PurchaseState, string> = {
  upcoming: 'pill',
  live: 'inline-flex items-center rounded-full bg-brand-success/10 px-3 py-1 text-xs font-medium text-brand-success',
  ended: 'inline-flex items-center rounded-full bg-brand-border/60 px-3 py-1 text-xs font-medium text-brand-muted',
  expired: 'inline-flex items-center rounded-full bg-brand-error/10 px-3 py-1 text-xs font-medium text-brand-error',
}

const DRAFT_CLASS = 'inline-flex items-center rounded-full bg-brand-border/60 px-3 py-1 text-xs font-medium text-brand-muted'
const PUBLISHED_CLASS = 'inline-flex items-center rounded-full bg-brand-success/10 px-3 py-1 text-xs font-medium text-brand-success'

function greeting(now: Date) {
  const hour =
    Number(new Intl.DateTimeFormat('en-NG', { hour: 'numeric', hour12: false, timeZone: 'Africa/Lagos' }).format(now)) % 24
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="card">
      <p className="eyebrow">{label}</p>
      <p className="mt-4 font-serif text-4xl text-brand-text">{value ?? '—'}</p>
    </div>
  )
}

function PurchaseRow({ purchase, state }: { purchase: Purchase; state: PurchaseState }) {
  const session = purchase.sessions
  if (!session) return null
  const when = formatSessionTime(session.starts_at)

  return (
    <div className="card flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">{session.sections?.name}</span>
          <span className={STATE_CLASS[state]}>{STATE_LABEL[state]}</span>
        </div>
        <p className="mt-2 text-lg font-medium text-brand-text">{session.title}</p>
        <p className="mt-1 text-sm text-brand-muted">
          {when.day}, {when.time}
          {session.guest_teachers && <> · {session.guest_teachers.name}</>}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {state !== 'expired' && (
          <Link to={`/sessions/${session.id}/room`} className="btn-primary px-4 py-2 text-sm">
            Session room
          </Link>
        )}
        {state !== 'expired' && (
          <AddToCalendarButton
            session={{
              id: session.id,
              title: session.title,
              starts_at: session.starts_at,
              ends_at: session.ends_at,
              teacherName: session.guest_teachers?.name ?? null,
              sectionName: session.sections?.name ?? null,
            }}
          />
        )}
        <Link to={`/cards/${purchase.card_id}`} className="btn-ghost px-4 py-2 text-sm">
          Access card
        </Link>
        <RefundRequestButton purchaseId={purchase.id} startsAt={session.starts_at} />
      </div>
    </div>
  )
}

function TeachingRowCard({ row }: { row: TeachRow }) {
  const when = formatSessionTime(row.starts_at)

  return (
    <div className="card flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">{row.sections?.name}</span>
          <span className={row.status === 'published' ? PUBLISHED_CLASS : DRAFT_CLASS}>
            {row.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>
        <p className="mt-2 text-lg font-medium text-brand-text">{row.title}</p>
        <p className="mt-1 text-sm text-brand-muted">
          {when.day}, {when.time}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-3">
        <Link to={`/teacher/sessions/${row.id}/chat`} className="btn-ghost px-4 py-2 text-sm">
          Chat
        </Link>
        <Link to={`/teacher/sessions/${row.id}/marking`} className="btn-ghost px-4 py-2 text-sm">
          Marking
        </Link>
        <Link to={`/teacher/sessions/${row.id}`} className="btn-primary px-4 py-2 text-sm">
          Manage
        </Link>
      </div>
    </div>
  )
}

function Group({ title, rows, empty }: { title: string; rows: Tagged[]; empty?: string }) {
  if (rows.length === 0 && !empty) return null
  return (
    <div>
      <h2 className="text-2xl">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-brand-muted">{empty}</p>
      ) : (
        <div className="mt-5 grid gap-4">
          {rows.map(({ p, s }) => (
            <PurchaseRow key={p.id} purchase={p} state={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex justify-between gap-6 py-4 text-sm">
      <dt className="text-brand-muted">{label}</dt>
      <dd className={`font-medium text-brand-text ${capitalize ? 'capitalize' : ''}`}>{value}</dd>
    </div>
  )
}

export default function Dashboard() {
  const { user, role, loading } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[] | null>(null)
  const [teaching, setTeaching] = useState<TeachRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let ignore = false

    fetchMyPurchases()
      .then((rows) => {
        if (!ignore) setPurchases(rows)
      })
      .catch((e) => {
        if (!ignore) setError(e.message)
      })

    // Sessions this account teaches. Assigned by the admin, so no purchase is needed.
    supabase
      .from('guest_teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data: teacher }) => {
        if (ignore) return
        if (!teacher) {
          setTeaching([])
          return
        }
        const { data } = await supabase
          .from('sessions')
          .select('id, title, starts_at, status, sections(name)')
          .eq('guest_teacher_id', teacher.id)
          .neq('status', 'cancelled')
          .order('starts_at')
        if (!ignore) setTeaching((data as unknown as TeachRow[]) ?? [])
      })

    return () => {
      ignore = true
    }
  }, [user])

  if (loading) return <p className="container-page py-16 text-brand-muted">Loading</p>
  if (!user) return <Navigate to="/login" replace />

  const now = new Date()
  const tagged: Tagged[] = (purchases ?? []).map((p) => ({ p, s: getPurchaseState(p, now) }))
  const current = tagged.filter((t) => t.s === 'live' || t.s === 'upcoming')
  const ended = tagged.filter((t) => t.s === 'ended')
  const expired = tagged.filter((t) => t.s === 'expired')
  const next = current.find((t) => t.s === 'upcoming') ?? current[0] ?? null
  const nextWhen = next?.p.sessions ? formatSessionTime(next.p.sessions.starts_at) : null

  const teachesAny = (teaching?.length ?? 0) > 0
  const bought = (purchases?.length ?? 0) > 0
  const loadingAll = purchases === null || teaching === null

  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    user.email?.split('@')[0] ??
    'there'
  const todayLabel = new Intl.DateTimeFormat('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Lagos',
  }).format(now)

  return (
    <section className="container-page py-12 sm:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-3 text-4xl">
            {greeting(now)}, <span className="capitalize">{firstName}</span>
          </h1>
          <p className="mt-3 text-brand-muted">Here's what's happening with your sessions.</p>
        </div>
        <p className="pill self-start sm:self-auto">{todayLabel}</p>
      </div>

      {!loadingAll && (
        <OnboardingChecklist
          user={user}
          hasPurchase={bought}
          firstSessionId={purchases?.[0]?.sessions?.id ?? null}
        />
      )}

      {bought && (
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <StatCard label="Active sessions" value={purchases ? current.length + ended.length : null} />
          <StatCard label="Upcoming" value={purchases ? current.filter((t) => t.s === 'upcoming').length : null} />
          <StatCard label="Expired" value={purchases ? expired.length : null} />
        </div>
      )}

      {next?.p.sessions && nextWhen && (
        <div className="mt-8 rounded-2xl bg-brand-primary p-8 text-white sm:p-10">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
            {next.s === 'live' ? 'Live now' : 'Next session'}
          </span>
          <h2 className="mt-5 text-3xl leading-snug text-white">{next.p.sessions.title}</h2>
          <p className="mt-3 text-white/75">
            {nextWhen.day}, {nextWhen.time}
            {next.p.sessions.guest_teachers && <> · with {next.p.sessions.guest_teachers.name}</>}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`/sessions/${next.p.sessions.id}/room`}
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-[15px] font-medium text-brand-primary transition hover:bg-white/90"
            >
              Open session room
            </Link>
            <Link
              to={`/cards/${next.p.card_id}`}
              className="inline-flex items-center justify-center rounded-xl border border-white/30 px-5 py-3 text-[15px] font-medium text-white transition hover:bg-white/10"
            >
              Access card
            </Link>
          </div>
        </div>
      )}

      {error && <p className="mt-10 text-sm text-brand-error">Your sessions could not be loaded. Please refresh.</p>}
      {loadingAll && !error && <p className="mt-12 text-sm text-brand-muted">Loading your sessions</p>}

      {!loadingAll && teachesAny && (
        <div className="mt-14">
          <h2 className="text-2xl">Sessions you teach</h2>
          <p className="mt-2 text-sm text-brand-muted">
            The admin assigns these to you. You don't need to buy them.
          </p>
          <div className="mt-5 grid gap-4">
            {teaching!.map((row) => (
              <TeachingRowCard key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}

      {!loadingAll && !bought && !teachesAny && (
        <div className="card mt-10 text-center">
          <h2 className="text-2xl">No sessions yet</h2>
          <p className="mt-3 text-brand-muted">Once you buy access to a session, it will appear here.</p>
          <Link to="/sessions" className="btn-primary mt-7">Browse sessions</Link>
        </div>
      )}

      {!loadingAll && bought && (
        <div className="mt-14 grid gap-12">
          <Group title="Live and upcoming" rows={current} empty="Nothing scheduled right now." />
          <Group title="Ended, access still open" rows={ended} />
          <Group title="Expired" rows={expired} />
        </div>
      )}

      <div className="card mt-14">
        <p className="eyebrow">Account</p>
        <dl className="mt-4 divide-y divide-brand-border">
          <InfoRow label="Email" value={user.email ?? ''} />
          <InfoRow label="Role" value={role ?? 'Unknown'} capitalize />
        </dl>
      </div>
    </section>
  )
}