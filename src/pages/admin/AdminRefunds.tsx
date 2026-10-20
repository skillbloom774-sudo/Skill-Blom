import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNaira, formatSessionTime } from '../../lib/sessions'
import { refundPurchase } from '../../lib/payments'
import {
  fetchSessionOptions,
  startOfDay,
  startOfNextDay,
  type SessionOption,
} from '../../lib/adminFilters'

const PAGE_SIZE = 20

type Status = 'pending' | 'approved' | 'rejected' | 'all'
const STATUSES: Status[] = ['pending', 'approved', 'rejected', 'all']

type Row = {
  id: string
  purchase_id: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  decided_at: string | null
  full_name: string | null
  phone: string | null
  email: string | null
  amount_paid_kobo: number
  paystack_reference: string
  session_id: string
  session_title: string
}

const STATUS_PILL: Record<Row['status'], string> = {
  pending: 'bg-brand-accent-soft text-brand-accent',
  approved: 'bg-brand-border/60 text-brand-muted',
  rejected: 'bg-brand-error/10 text-brand-error',
}

function nameOf(name: string | null) {
  return name?.trim() || 'Student'
}

function day(iso: string) {
  return formatSessionTime(iso).day
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm capitalize transition ${
    active
      ? 'bg-brand-primary text-white'
      : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
  }`
}

export default function AdminRefunds() {
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [status, setStatus] = useState<Status>('pending')
  const [sessionId, setSessionId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<{ key: string; rows: Row[]; total: number } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    fetchSessionOptions()
      .then((rows) => {
        if (!ignore) setSessions(rows)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    const key = [status, sessionId, from, to, page, reloadKey].join('|')

    supabase
      .rpc('search_refund_requests', {
        p_status: status === 'all' ? null : status,
        p_session_id: sessionId || null,
        p_from: startOfDay(from),
        p_to: startOfNextDay(to),
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      })
      .then(({ data, error }) => {
        if (ignore) return
        if (error) {
          setError(error.message)
          return
        }
        const payload = data as { total: number; rows: Row[] }
        setError(null)
        setResult({ key, rows: payload.rows, total: payload.total })
      })

    return () => {
      ignore = true
    }
  }, [status, sessionId, from, to, page, reloadKey])

  const currentKey = [status, sessionId, from, to, page, reloadKey].join('|')
  const loading = result?.key !== currentKey
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from1 = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to1 = Math.min(page * PAGE_SIZE, total)

  function clearFilters() {
    setSessionId('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  async function approve(r: Row) {
    if (
      !confirm(
        `Approve the refund for ${nameOf(r.full_name)}? Their money goes back through Paystack and their access ends.`,
      )
    ) {
      return
    }
    setBusyId(r.id)
    setError(null)
    setNotice(null)
    const { error } = await refundPurchase(r.purchase_id, r.reason)
    setBusyId(null)
    if (error) {
      setError(error)
      return
    }
    setNotice('Refund approved and sent. The student has been emailed.')
    setReloadKey((k) => k + 1)
  }

  async function decline(r: Row) {
    if (!confirm(`Decline the refund request from ${nameOf(r.full_name)}?`)) return
    setBusyId(r.id)
    setError(null)
    setNotice(null)
    const { error } = await supabase
      .from('refund_requests')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', r.id)
    setBusyId(null)
    if (error) {
      setError(error.message)
      return
    }
    setNotice('Request declined.')
    setReloadKey((k) => k + 1)
  }

  const filtersActive = Boolean(sessionId || from || to)

  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-4xl">Refund requests</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Approving a request sends the money back through Paystack. Declining leaves the student's access in place.
      </p>

      <div className="mt-10 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            className={chipClass(status === s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="rf-session">Session</label>
          <select
            id="rf-session"
            className="field"
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rf-from">Requested from</label>
          <input
            id="rf-from"
            type="date"
            className="field"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="rf-to">to</label>
          <input
            id="rf-to"
            type="date"
            className="field"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>
      {filtersActive && (
        <button onClick={clearFilters} className="mt-3 text-sm text-brand-muted hover:text-brand-primary">
          Clear session and date filters
        </button>
      )}

      {error && <p className="mt-8 whitespace-pre-line text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-8 text-sm text-brand-success">{notice}</p>}
      {result === null && !error && <p className="mt-10 text-brand-muted">Loading requests</p>}
      {result !== null && !loading && total === 0 && (
        <p className="mt-10 text-brand-muted">No refund requests match these filters.</p>
      )}

      <div className={`mt-8 grid gap-4 transition ${loading ? 'opacity-50' : ''}`}>
        {rows.map((r) => (
          <div key={r.id} className="card flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-medium text-brand-text">{nameOf(r.full_name)}</p>
                <span className={`pill capitalize ${STATUS_PILL[r.status]}`}>{r.status}</span>
              </div>
              <p className="mt-1 text-sm text-brand-muted">
                {r.phone ?? 'No phone'} · {r.email ?? 'No email'}
              </p>
              <p className="mt-1 text-sm text-brand-muted">
                {r.session_title} · {formatNaira(r.amount_paid_kobo)}
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                Requested {day(r.created_at)}
                {r.decided_at && <> · Decided {day(r.decided_at)}</>}
              </p>
              <p className="mt-4 whitespace-pre-line rounded-xl bg-brand-background p-4 text-sm leading-relaxed text-brand-text">
                {r.reason}
              </p>
            </div>

            {r.status === 'pending' && (
              <div className="flex shrink-0 gap-3">
                <button
                  onClick={() => approve(r)}
                  disabled={busyId === r.id}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  Approve refund
                </button>
                <button
                  onClick={() => decline(r)}
                  disabled={busyId === r.id}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-brand-border pt-8">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1 || loading}
            className="btn-ghost disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-sm text-brand-muted">
            {from1}–{to1} of {total}
          </p>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pages || loading}
            className="btn-ghost disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  )
}