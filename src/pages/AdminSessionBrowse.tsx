import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatNaira, formatSessionTime } from '../lib/sessions'
import PageHeader from '../components/PageHeader'

const PAGE_SIZE = 50

type Row = {
  id: string
  title: string
  starts_at: string
  status: 'draft' | 'published' | 'cancelled'
  price_kobo: number
  section_name: string
  teacher_name: string | null
  paid_count: number
}

const STATUS_PILL: Record<Row['status'], string> = {
  published: 'bg-brand-success/10 text-brand-success',
  draft: 'bg-brand-border/60 text-brand-muted',
  cancelled: 'bg-brand-error/10 text-brand-error',
}

export default function AdminSessionBrowse() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')

  useEffect(() => {
    let ignore = false

    supabase
      .rpc('search_admin_sessions', {
        p_query: query || null,
        p_status: null,
        p_limit: PAGE_SIZE,
        p_offset: 0,
      })
      .then(({ data, error }) => {
        if (ignore) return
        if (error) {
          setError(error.message)
          return
        }
        setError(null)
        setRows((data as { rows: Row[] }).rows ?? [])
      })

    return () => {
      ignore = true
    }
  }, [query])

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    setQuery(draftQuery.trim())
  }

  return (
    <section className="container-page py-12 sm:py-16">
      <PageHeader
        eyebrow="Sessions"
        title="Your sessions"
        description="Every session you've created, including drafts. Open one to enter its room."
        actions={
          <Link to="/admin/sessions" className="btn-primary">
            Create session
          </Link>
        }
      />

      <form onSubmit={submitSearch} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <input
          className="field sm:max-w-md"
          placeholder="Search by title, teacher, or section"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          aria-label="Search your sessions"
        />
        <div className="flex gap-3">
          <button type="submit" className="btn-primary">Search</button>
          {query && (
            <button
              type="button"
              onClick={() => {
                setDraftQuery('')
                setQuery('')
              }}
              className="btn-ghost"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && <p className="mt-8 text-sm text-brand-error">{error}</p>}
      {!error && rows === null && <p className="mt-10 text-brand-muted">Loading sessions</p>}

      {rows !== null && rows.length === 0 && (
        <div className="card mt-10 text-center">
          <h2 className="text-2xl">{query ? 'No sessions match' : 'No sessions yet'}</h2>
          <p className="mt-3 text-brand-muted">
            {query ? 'Try a different search.' : 'Create your first session to get started.'}
          </p>
          {!query && (
            <Link to="/admin/sessions" className="btn-primary mt-7">
              Create a session
            </Link>
          )}
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mt-10 grid gap-4">
          {rows.map((r) => {
            const when = formatSessionTime(r.starts_at)
            return (
              <div
                key={r.id}
                className="card flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="eyebrow">{r.section_name}</span>
                    <span className={`pill capitalize ${STATUS_PILL[r.status]}`}>{r.status}</span>
                  </div>
                  <Link
                    to={`/sessions/${r.id}/room`}
                    className="mt-2 block text-lg font-medium text-brand-text transition hover:text-brand-primary"
                  >
                    {r.title}
                  </Link>
                  <p className="mt-1 text-sm text-brand-muted">
                    {when.day}, {when.time}
                    {r.teacher_name && <> · {r.teacher_name}</>}
                  </p>
                  <p className="mt-1 text-xs text-brand-muted">
                    {r.paid_count} paid {r.paid_count === 1 ? 'student' : 'students'} · {formatNaira(r.price_kobo)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-3">
                  <Link to={`/sessions/${r.id}/room`} className="btn-primary px-4 py-2 text-sm">
                    Open room
                  </Link>
                  <Link to={`/admin/sessions/${r.id}`} className="btn-ghost px-4 py-2 text-sm">
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}