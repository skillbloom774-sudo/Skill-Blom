import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import SessionCard from '../components/SessionCard'
import { useAuth } from '../lib/useAuth'
import {
  PAGE_SIZE,
  fetchSectionOptions,
  searchSessions,
  type SearchResult,
} from '../lib/sessionSearch'

type Section = { slug: string; name: string }

const PRICE_OPTIONS = [
  { value: '', label: 'Any price' },
  { value: 'under5k', label: 'Under ₦5,000' },
  { value: '5k-10k', label: '₦5,000 to ₦10,000' },
  { value: 'over10k', label: 'Over ₦10,000' },
]

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm transition ${
    active
      ? 'bg-brand-primary text-white'
      : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
  }`
}

export default function Sessions() {
  const { role } = useAuth()
  const [params, setParams] = useSearchParams()

  const query = params.get('q') ?? ''
  const section = params.get('section') ?? ''
  const price = params.get('price') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const key = `${query}|${section}|${price}|${page}`

  const [draftQuery, setDraftQuery] = useState(query)
  const [sections, setSections] = useState<Section[]>([])
  const [result, setResult] = useState<(SearchResult & { key: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    fetchSectionOptions()
      .then((rows) => {
        if (!ignore) setSections(rows)
      })
      .catch(() => {
        if (!ignore) setSections([])
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    searchSessions({ query, section, price, page })
      .then((r) => {
        if (!ignore) {
          setResult({ ...r, key })
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!ignore) setError(e.message)
      })
    return () => {
      ignore = true
    }
  }, [query, section, price, page, key])

  // Teachers are assigned to sessions, so they never browse them
  if (role === 'guest_teacher') return <Navigate to="/teacher" replace />

  const loading = result?.key !== key
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Boolean(query || section || price)

  const monthLabel = new Intl.DateTimeFormat('en-NG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date())

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next)
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    update({ q: draftQuery.trim() || null, page: null })
  }

  function goToPage(n: number) {
    update({ page: n > 1 ? String(n) : null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function clearAll() {
    setDraftQuery('')
    setParams(new URLSearchParams())
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{monthLabel}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">Sessions this month</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-brand-muted">
            Each session is a one-month purchase, taught live by the guest named on the listing.
          </p>
        </div>
        {result && !loading && (
          <p className="text-sm text-brand-muted">
            {total} {total === 1 ? 'session' : 'sessions'}
          </p>
        )}
      </div>

      <form onSubmit={submitSearch} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <input
          className="field sm:max-w-md"
          placeholder="Search by title, teacher, or section"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          aria-label="Search sessions"
        />
        <div className="flex gap-3">
          <button type="submit" className="btn-primary">Search</button>
          {hasFilters && (
            <button type="button" onClick={clearAll} className="btn-ghost">
              Clear
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {sections.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => update({ section: null, page: null })} className={chipClass(!section)}>
              All sections
            </button>
            {sections.map((s) => (
              <button
                key={s.slug}
                onClick={() => update({ section: s.slug, page: null })}
                className={chipClass(section === s.slug)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        <select
          className="field w-auto min-w-[12rem]"
          value={price}
          onChange={(e) => update({ price: e.target.value || null, page: null })}
          aria-label="Filter by price"
        >
          {PRICE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="mt-12 text-sm text-brand-error">Sessions could not be loaded. Please refresh.</p>}
      {!result && !error && <p className="mt-12 text-brand-muted">Loading sessions</p>}

      {result && !error && rows.length === 0 && !loading && (
        <div className="card mt-12 text-center">
          <h2 className="text-2xl">No sessions match</h2>
          <p className="mt-3 text-brand-muted">
            {hasFilters
              ? 'Try a different search or clear the filters.'
              : 'New sessions appear here once they are published.'}
          </p>
          {hasFilters && (
            <button onClick={clearAll} className="btn-ghost mt-6">Clear filters</button>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className={`mt-12 grid gap-6 transition md:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-50' : ''}`}>
          {rows.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}

      {result && pages > 1 && (
        <div className="mt-14 flex items-center justify-between gap-4 border-t border-brand-border pt-8">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || loading}
            className="btn-ghost disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-sm text-brand-muted">
            Page {page} of {pages}
          </p>
          <button
            onClick={() => goToPage(page + 1)}
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