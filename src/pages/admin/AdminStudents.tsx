import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatSessionTime } from '../../lib/sessions'

const PAGE_SIZE = 20

type StudentStatus = 'all' | 'paying' | 'active' | 'refunded' | 'no_purchase'
const FILTERS: StudentStatus[] = ['all', 'paying', 'active', 'refunded', 'no_purchase']
const FILTER_LABEL: Record<StudentStatus, string> = {
  all: 'All',
  paying: 'Has paid',
  active: 'Active access',
  refunded: 'Refunded',
  no_purchase: 'Never bought',
}

type Row = {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  created_at: string
  paid_count: number
  active_count: number
  refunded_count: number
  purchase_count: number
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm transition ${
    active
      ? 'bg-brand-primary text-white'
      : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
  }`
}

export default function AdminStudents() {
  const [result, setResult] = useState<{ key: string; rows: Row[]; total: number } | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [filter, setFilter] = useState<StudentStatus>('all')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const key = `${query}|${filter}|${page}`

    supabase
      .rpc('search_admin_students', {
        p_query: query || null,
        p_status: filter === 'all' ? null : filter,
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
  }, [query, filter, page])

  const currentKey = `${query}|${filter}|${page}`
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

  function chooseFilter(f: StudentStatus) {
    setFilter(f)
    setPage(1)
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-4xl">Students</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Find a student by name, email, or phone. Open a student to see their sessions, access, and refunds.
      </p>

      <form onSubmit={submitSearch} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <input
          className="field sm:max-w-md"
          placeholder="Search by name, email, or phone"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          aria-label="Search students"
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
          <button key={f} onClick={() => chooseFilter(f)} className={chipClass(filter === f)}>
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {error && <p className="mt-8 text-sm text-brand-error">{error}</p>}
      {result === null && !error && <p className="mt-8 text-brand-muted">Loading students</p>}
      {result !== null && !loading && total === 0 && (
        <p className="mt-8 text-brand-muted">
          {query || filter !== 'all' ? 'No students match these filters.' : 'No students have signed up yet.'}
        </p>
      )}

      <div className={`mt-6 divide-y divide-brand-border border-t border-brand-border transition ${loading ? 'opacity-50' : ''}`}>
        {rows.map((s) => (
          <div key={s.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-brand-text">{s.full_name?.trim() || 'No name'}</p>
              <p className="mt-1 text-sm text-brand-muted">
                {s.email ?? 'No email'} · {s.phone ?? 'No phone'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="pill">Joined {formatSessionTime(s.created_at).day}</span>
                <span className="pill bg-brand-border/60 text-brand-muted">
                  {s.purchase_count} {s.purchase_count === 1 ? 'purchase' : 'purchases'}
                </span>
                {s.active_count > 0 && (
                  <span className="pill bg-brand-success/10 text-brand-success">
                    {s.active_count} active
                  </span>
                )}
                {s.refunded_count > 0 && (
                  <span className="pill bg-brand-error/10 text-brand-error">
                    {s.refunded_count} refunded
                  </span>
                )}
              </div>
            </div>
            <Link to={`/admin/students/${s.id}`} className="btn-ghost shrink-0 px-4 py-2 text-sm">
              View student
            </Link>
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
    </section>
  )
}