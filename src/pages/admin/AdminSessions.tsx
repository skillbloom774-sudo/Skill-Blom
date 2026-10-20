import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatNaira } from '../../lib/sessions'

const PAGE_SIZE = 20

type Section = { id: string; name: string }
type Teacher = { id: string; name: string }

type SessionRow = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  status: 'draft' | 'published' | 'cancelled'
  price_kobo: number
  section_name: string
  teacher_name: string | null
  paid_count: number
}

type StatusFilter = 'all' | 'published' | 'draft' | 'cancelled'
const STATUS_FILTERS: StatusFilter[] = ['all', 'published', 'draft', 'cancelled']

const STATUS_PILL: Record<SessionRow['status'], string> = {
  published: 'bg-brand-success/10 text-brand-success',
  draft: 'bg-brand-border/60 text-brand-muted',
  cancelled: 'bg-brand-error/10 text-brand-error',
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-brand-muted">{hint}</p>}
    </div>
  )
}

function toInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function endOfMonth(from: Date) {
  return toInputValue(new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59))
}

function formatWhen(iso: string) {
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

export default function AdminSessions() {
  const [sections, setSections] = useState<Section[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [result, setResult] = useState<{ key: string; rows: SessionRow[]; total: number } | null>(null)

  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Create-form state
  const [sectionId, setSectionId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [accessEndsAt, setAccessEndsAt] = useState('')
  const [priceNaira, setPriceNaira] = useState('')
  const [limit, setLimit] = useState('')
  const [newStatus, setNewStatus] = useState<'draft' | 'published'>('draft')

  // Sections and teachers for the create form
  useEffect(() => {
    let ignore = false

    Promise.all([
      supabase.from('sections').select('id, name').order('name'),
      supabase.from('guest_teachers').select('id, name').order('name'),
    ]).then(([secRes, teacherRes]) => {
      if (ignore) return
      setSections(secRes.data ?? [])
      setTeachers(teacherRes.data ?? [])
    })

    return () => {
      ignore = true
    }
  }, [])

  // Sessions for the current search, filter and page
  useEffect(() => {
    let ignore = false
    const key = `${query}|${status}|${page}|${reloadKey}`

    supabase
      .rpc('search_admin_sessions', {
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
        const payload = data as { total: number; rows: SessionRow[] }
        setError(null)
        setResult({ key, rows: payload.rows, total: payload.total })
      })

    return () => {
      ignore = true
    }
  }, [query, status, page, reloadKey])

  const currentKey = `${query}|${status}|${page}|${reloadKey}`
  const loading = result?.key !== currentKey
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  function reload() {
    setReloadKey((k) => k + 1)
  }

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

  function chooseStatus(s: StatusFilter) {
    setStatus(s)
    setPage(1)
  }

  function handleStartChange(value: string) {
    setStartsAt(value)
    if (!value) return
    const start = new Date(value)
    setEndsAt(toInputValue(new Date(start.getTime() + 2 * 60 * 60 * 1000)))
    setAccessEndsAt(endOfMonth(start))
  }

  function resetForm() {
    setSectionId('')
    setTeacherId('')
    setTitle('')
    setDescription('')
    setStartsAt('')
    setEndsAt('')
    setAccessEndsAt('')
    setPriceNaira('')
    setLimit('')
    setNewStatus('draft')
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const start = new Date(startsAt)
    const end = new Date(endsAt)
    const access = new Date(accessEndsAt)

    if (end <= start) {
      setError('The end time must be after the start time.')
      return
    }
    if (access < end) {
      setError('Access must last until at least the session ends. Set Access ends to a later time.')
      return
    }

    const priceKobo = Math.round(Number(priceNaira) * 100)
    if (!Number.isFinite(priceKobo) || priceKobo < 0) {
      setError('Enter a valid price in naira.')
      return
    }

    setBusy(true)
    const { error: insertError } = await supabase.from('sessions').insert({
      section_id: sectionId,
      guest_teacher_id: teacherId || null,
      title,
      description: description || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      access_ends_at: access.toISOString(),
      price_kobo: priceKobo,
      enrollment_limit: limit ? Number(limit) : null,
      status: newStatus,
    })
    setBusy(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    resetForm()
    setNotice('Session created.')
    reload()
  }

  async function togglePublish(s: SessionRow) {
    const next = s.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('sessions').update({ status: next }).eq('id', s.id)
    if (error) setError(error.message)
    else reload()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this session? Only sessions with no purchases can be deleted.')) return
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) setError(error.message)
    else reload()
  }

  return (
    <section className="container-page py-16 sm:py-20">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-3xl">Sessions</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Create the session and assign its guest teacher. The teacher adds the Zoom or Google Meet link from
        their teaching area.
      </p>

      {sections.length === 0 && (
        <p className="mt-6 text-sm text-brand-muted">Add at least one section before creating a session.</p>
      )}

      <form onSubmit={handleCreate} className="card mt-10 grid gap-6 sm:max-w-3xl">
        <h2 className="text-xl">Create a session</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="s-section" label="Section">
            <select id="s-section" className="field" value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
              <option value="">Choose a section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field id="s-teacher" label="Guest teacher">
            <select id="s-teacher" className="field" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">No teacher yet</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="s-title" label="Session title">
          <input id="s-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>

        <Field id="s-desc" label="Description">
          <textarea id="s-desc" className="field min-h-28" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="s-start" label="Starts">
            <input
              id="s-start"
              type="datetime-local"
              className="field"
              value={startsAt}
              onChange={(e) => handleStartChange(e.target.value)}
              required
            />
          </Field>
          <Field id="s-end" label="Ends">
            <input
              id="s-end"
              type="datetime-local"
              className="field"
              value={endsAt}
              min={startsAt || undefined}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="s-access" label="Access ends" hint="Students keep access until this time. It must be after the session ends.">
            <input
              id="s-access"
              type="datetime-local"
              className="field"
              min={endsAt || undefined}
              value={accessEndsAt}
              onChange={(e) => setAccessEndsAt(e.target.value)}
              required
            />
          </Field>
          <Field id="s-price" label="Price (₦)">
            <input
              id="s-price"
              type="number"
              min="0"
              step="100"
              className="field"
              value={priceNaira}
              onChange={(e) => setPriceNaira(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="s-limit" label="Enrollment limit (optional)">
            <input id="s-limit" type="number" min="1" className="field" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
          <Field id="s-status" label="Status">
            <select
              id="s-status"
              className="field"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as 'draft' | 'published')}
            >
              <option value="draft">Draft (hidden from students)</option>
              <option value="published">Published</option>
            </select>
          </Field>
        </div>

        {error && <p className="text-sm text-brand-error">{error}</p>}
        {notice && <p className="text-sm text-brand-success">{notice}</p>}

        <div>
          <button type="submit" disabled={busy || sections.length === 0} className="btn-primary">
            {busy ? 'Saving' : 'Create session'}
          </button>
        </div>
      </form>

      <div className="mt-16">
        <h2 className="text-2xl">All sessions</h2>

        <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="field sm:max-w-md"
            placeholder="Search by title, teacher, or section"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            aria-label="Search sessions"
          />
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Search</button>
            {query && (
              <button type="button" onClick={clearSearch} className="btn-ghost">Clear</button>
            )}
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => chooseStatus(s)} className={chipClass(status === s)}>
              {s}
            </button>
          ))}
        </div>

        {error && <p className="mt-6 text-sm text-brand-error">{error}</p>}
        {result === null && !error && <p className="mt-8 text-brand-muted">Loading sessions</p>}
        {result !== null && !loading && total === 0 && (
          <p className="mt-8 text-brand-muted">No sessions match these filters.</p>
        )}

        <div className={`mt-6 divide-y divide-brand-border border-t border-brand-border transition ${loading ? 'opacity-50' : ''}`}>
          {rows.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium text-brand-text">{s.title}</p>
                  <span className={`pill capitalize ${STATUS_PILL[s.status]}`}>{s.status}</span>
                </div>
                <p className="mt-1 text-sm text-brand-muted">
                  {s.section_name} · {formatWhen(s.starts_at)} · {formatNaira(s.price_kobo)}
                  {s.teacher_name && <> · {s.teacher_name}</>}
                </p>
                <p className="mt-1 text-xs text-brand-muted">
                  {s.paid_count} paid {s.paid_count === 1 ? 'student' : 'students'}
                </p>
              </div>
              <div className="flex shrink-0 gap-5 text-sm">
                <Link to={`/admin/sessions/${s.id}`} className="text-brand-primary hover:underline">Edit</Link>
                {s.status !== 'cancelled' && (
                  <button onClick={() => togglePublish(s)} className="text-brand-primary hover:underline">
                    {s.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                )}
                <button onClick={() => handleDelete(s.id)} className="text-brand-error hover:underline">
                  Delete
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