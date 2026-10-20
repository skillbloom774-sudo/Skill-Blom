import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatSessionTime } from '../../lib/sessions'
import {
  fetchSessionOptions,
  startOfDay,
  startOfNextDay,
  type SessionOption,
} from '../../lib/adminFilters'

const PAGE_SIZE = 20

type Report = {
  report_id: string
  reason: string | null
  created_at: string
  message_id: string
  body: string
  is_anonymous: boolean
  session_id: string
  session_title: string
  sender_name: string
  reporter_name: string
}

function when(iso: string) {
  const f = formatSessionTime(iso)
  return `${f.day}, ${f.time}`
}

export default function AdminModeration() {
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [sessionId, setSessionId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<{ key: string; rows: Report[]; total: number } | null>(null)
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
    const key = [sessionId, from, to, page, reloadKey].join('|')

    supabase
      .rpc('search_message_reports', {
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
        const payload = data as { total: number; rows: Report[] }
        setError(null)
        setResult({ key, rows: payload.rows, total: payload.total })
      })

    return () => {
      ignore = true
    }
  }, [sessionId, from, to, page, reloadKey])

  const currentKey = [sessionId, from, to, page, reloadKey].join('|')
  const loading = result?.key !== currentKey
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from1 = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to1 = Math.min(page * PAGE_SIZE, total)
  const filtersActive = Boolean(sessionId || from || to)

  async function removeMessage(r: Report) {
    if (!confirm('Delete this message for everyone? Its reports are removed with it.')) return
    setBusyId(r.report_id)
    setError(null)
    setNotice(null)
    const { error } = await supabase.from('chat_messages').delete().eq('id', r.message_id)
    setBusyId(null)
    if (error) {
      setError(error.message)
      return
    }
    setNotice('Message deleted.')
    setReloadKey((k) => k + 1)
  }

  async function dismiss(r: Report) {
    setBusyId(r.report_id)
    setError(null)
    setNotice(null)
    const { error } = await supabase
      .from('message_reports')
      .update({ status: 'resolved' })
      .eq('id', r.report_id)
    setBusyId(null)
    if (error) {
      setError(error.message)
      return
    }
    setNotice('Report dismissed.')
    setReloadKey((k) => k + 1)
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-4xl">Moderation</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Messages students have reported. You can see the real sender, even for anonymous messages.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="mod-session">Session</label>
          <select
            id="mod-session"
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
          <label className="label" htmlFor="mod-from">Reported from</label>
          <input
            id="mod-from"
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
          <label className="label" htmlFor="mod-to">to</label>
          <input
            id="mod-to"
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
        <button
          onClick={() => {
            setSessionId('')
            setFrom('')
            setTo('')
            setPage(1)
          }}
          className="mt-3 text-sm text-brand-muted hover:text-brand-primary"
        >
          Clear filters
        </button>
      )}

      {error && <p className="mt-8 text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-8 text-sm text-brand-success">{notice}</p>}
      {result === null && !error && <p className="mt-10 text-brand-muted">Loading reports</p>}
      {result !== null && !loading && total === 0 && (
        <div className="card mt-10 text-brand-muted">
          {filtersActive ? 'No reports match these filters.' : 'No open reports. Nothing needs your attention.'}
        </div>
      )}

      <div className={`mt-10 grid gap-5 transition ${loading ? 'opacity-50' : ''}`}>
        {rows.map((r) => (
          <div key={r.report_id} className="card flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-brand-muted">
                {r.session_title} · {when(r.created_at)}
              </p>
              <p className="mt-2 font-medium text-brand-text">
                {r.sender_name}
                {r.is_anonymous && <span className="ml-2 pill">Sent anonymously</span>}
              </p>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-brand-background p-4 text-sm leading-relaxed text-brand-text">
                {r.body}
              </p>
              <p className="mt-3 text-sm text-brand-muted">
                Reported by {r.reporter_name}
                {r.reason && <>: "{r.reason}"</>}
              </p>
            </div>

            <div className="flex shrink-0 gap-3">
              <button
                onClick={() => removeMessage(r)}
                disabled={busyId === r.report_id}
                className="rounded-xl border border-brand-error px-4 py-2 text-sm font-medium text-brand-error transition hover:bg-brand-error/10 disabled:opacity-50"
              >
                Delete message
              </button>
              <button
                onClick={() => dismiss(r)}
                disabled={busyId === r.report_id}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Dismiss
              </button>
            </div>
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