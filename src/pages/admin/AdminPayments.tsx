import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatNaira } from '../../lib/sessions'
import { refundPurchase } from '../../lib/payments'

const PAGE_SIZE = 25

type Filter = 'all' | 'paid' | 'refunded' | 'pending' | 'failed'
const FILTERS: Filter[] = ['all', 'paid', 'refunded', 'pending', 'failed']

type PurchaseRow = {
  id: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  amount_paid_kobo: number
  paid_at: string | null
  created_at: string
  paystack_reference: string
  full_name: string | null
  phone: string | null
  email: string | null
  session_title: string
}

type Totals = { collected: number; refunded: number }

const STATUS_PILL: Record<PurchaseRow['status'], string> = {
  paid: 'bg-brand-success/10 text-brand-success',
  refunded: 'bg-brand-border/60 text-brand-muted',
  pending: 'bg-brand-accent-soft text-brand-accent',
  failed: 'bg-brand-error/10 text-brand-error',
}

function nameOf(name: string | null | undefined) {
  return name?.trim() || 'Student'
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm capitalize transition ${
    active
      ? 'bg-brand-primary text-white'
      : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
  }`
}

export default function AdminPayments() {
  const [totals, setTotals] = useState<Totals | null>(null)
  const [pendingRequests, setPendingRequests] = useState<number | null>(null)
  const [result, setResult] = useState<{ key: string; rows: PurchaseRow[]; total: number } | null>(null)

  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [status, setStatus] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    const key = `${query}|${status}|${page}|${reloadKey}`

    supabase
      .rpc('search_purchases', {
        p_query: query || null,
        p_status: status === 'all' ? null : status,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      })
      .then(({ data, error }) => {
        if (ignore) return
        if (error) {
          setError(error.message)
          return
        }
        const payload = data as { total: number; rows: PurchaseRow[] }
        setError(null)
        setResult({ key, rows: payload.rows, total: payload.total })
      })

    return () => {
      ignore = true
    }
  }, [query, status, page, reloadKey])

  useEffect(() => {
    let ignore = false

    Promise.all([
      supabase.rpc('payment_totals'),
      supabase.from('refund_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(([totalsRes, requestsRes]) => {
      if (ignore) return
      if (!totalsRes.error && totalsRes.data) setTotals(totalsRes.data as Totals)
      setPendingRequests(requestsRes.count ?? 0)
    })

    return () => {
      ignore = true
    }
  }, [reloadKey])

  const currentKey = `${query}|${status}|${page}|${reloadKey}`
  const loading = result?.key !== currentKey
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    setQuery(draftQuery.trim())
    setPage(1)
  }

  function clearSearch() {
    setDraftQuery('')
    setQuery('')
    setPage(1)
  }

  function chooseStatus(s: Filter) {
    setStatus(s)
    setPage(1)
  }

  async function refund(purchaseId: string, who: string) {
    if (!confirm(`Refund ${who}? Their money goes back and their access ends.`)) return
    setBusyId(purchaseId)
    setError(null)
    setNotice(null)
    const { error } = await refundPurchase(purchaseId, 'Refund issued by Skillbloom')
    setBusyId(null)
    if (error) {
      setError(error)
      return
    }
    setNotice('Refund issued. The student has been emailed.')
    setReloadKey((k) => k + 1)
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-4xl">Payments</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Search every payment, or refund a paid purchase directly. Refunds go back through Paystack.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        <div className="card">
          <p className="eyebrow">Collected</p>
          <p className="mt-4 font-serif text-3xl text-brand-text">
            {totals ? formatNaira(totals.collected) : '—'}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Refunded</p>
          <p className="mt-4 font-serif text-3xl text-brand-text">
            {totals ? formatNaira(totals.refunded) : '—'}
          </p>
        </div>
        <Link to="/admin/refunds" className="card transition hover:border-brand-primary">
          <p className="eyebrow">Refund requests waiting</p>
          <p className="mt-4 font-serif text-3xl text-brand-text">{pendingRequests ?? '—'}</p>
          <p className="mt-2 text-sm text-brand-primary">Review requests →</p>
        </Link>
      </div>

      {error && <p className="mt-8 whitespace-pre-line text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-8 text-sm text-brand-success">{notice}</p>}

      <div className="mt-14">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="field sm:max-w-md"
            placeholder="Search by name, phone, email, session, or reference"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            aria-label="Search payments"
          />
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Search</button>
            {query && (
              <button type="button" onClick={clearSearch} className="btn-ghost">Clear</button>
            )}
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => chooseStatus(f)} className={chipClass(status === f)}>
              {f}
            </button>
          ))}
        </div>

        {result === null && !error && <p className="mt-8 text-brand-muted">Loading payments</p>}
        {result !== null && !loading && total === 0 && (
          <p className="mt-8 text-brand-muted">No payments match these filters.</p>
        )}

        <div className={`mt-6 divide-y divide-brand-border border-t border-brand-border transition ${loading ? 'opacity-50' : ''}`}>
          {rows.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium text-brand-text">{nameOf(p.full_name)}</p>
                  <span className={`pill capitalize ${STATUS_PILL[p.status]}`}>{p.status}</span>
                </div>
                <p className="mt-1 text-sm text-brand-muted">
                  {p.email ?? 'No email'} · {p.phone ?? 'No phone'}
                </p>
                <p className="mt-1 text-sm text-brand-muted">
                  {p.session_title} · {formatNaira(p.amount_paid_kobo)}
                  {p.paid_at && <> · {when(p.paid_at)}</>}
                </p>
                <p className="mt-1 font-mono text-xs text-brand-muted">{p.paystack_reference}</p>
              </div>
              {p.status === 'paid' && (
                <button
                  onClick={() => refund(p.id, nameOf(p.full_name))}
                  disabled={busyId === p.id}
                  className="shrink-0 text-sm text-brand-error hover:underline disabled:opacity-50"
                >
                  Refund
                </button>
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
              {from}–{to} of {total}
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
      </div>
    </section>
  )
}