import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatSessionTime } from '../../lib/sessions'
import PageHeader from '../../components/PageHeader'

type Row = {
  student_id: string
  name: string
  phone: string | null
  attended: boolean
  marked_at: string | null
}

export default function TeacherAttendance() {
  const { id } = useParams()
  const [title, setTitle] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let ignore = false

    Promise.all([
      supabase.from('sessions').select('title, starts_at').eq('id', id).maybeSingle(),
      supabase.rpc('session_attendance', { p_session_id: id }),
    ]).then(([sessionRes, attendanceRes]) => {
      if (ignore) return
      setTitle(sessionRes.data?.title ?? null)
      setStartsAt(sessionRes.data?.starts_at ?? null)

      if (attendanceRes.error) {
        setError(attendanceRes.error.message)
        setRows([])
        return
      }

      const list = (attendanceRes.data as Row[]) ?? []
      setRows(list)
      setPresent(new Set(list.filter((r) => r.attended).map((r) => r.student_id)))
      setDirty(false)
    })

    return () => {
      ignore = true
    }
  }, [id, reloadKey])

  function toggle(studentId: string) {
    setPresent((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
    setDirty(true)
    setNotice(null)
  }

  function markAll(attended: boolean) {
    setPresent(attended && rows ? new Set(rows.map((r) => r.student_id)) : new Set())
    setDirty(true)
    setNotice(null)
  }

  async function save() {
    if (!id || !rows) return
    setBusy(true)
    setError(null)
    setNotice(null)

    const records = rows.map((r) => ({
      student_id: r.student_id,
      attended: present.has(r.student_id),
    }))

    const { error } = await supabase.rpc('save_attendance', {
      p_session_id: id,
      p_records: records,
    })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    setNotice('Attendance saved.')
    setReloadKey((k) => k + 1)
  }

  if (!rows) return <p className="container-page py-16 text-brand-muted">Loading attendance</p>

  if (!title) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">Session not found</h1>
        <p className="mt-4 text-brand-muted">It may not be assigned to you.</p>
        <Link to="/teacher" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to your sessions
        </Link>
      </section>
    )
  }

  const term = query.trim().toLowerCase()
  const visible = rows.filter(
    (r) =>
      !term ||
      r.name.toLowerCase().includes(term) ||
      (r.phone ?? '').toLowerCase().includes(term),
  )
  const when = startsAt ? formatSessionTime(startsAt) : null

  return (
    <section className="container-page py-12 sm:py-16">
      <Link to="/teacher" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← Your sessions
      </Link>

      <div className="mt-8">
        <PageHeader
          eyebrow="Attendance"
          title={title}
          description={when ? `${when.day}, ${when.time}` : undefined}
        />
      </div>

      <div className="card mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-serif text-2xl text-brand-text">
            {present.size} of {rows.length} present
          </p>
          <p className="mt-1 text-sm text-brand-muted">Tick each student who attended the live session.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => markAll(true)} disabled={rows.length === 0} className="btn-ghost px-4 py-2 text-sm">
            Mark all present
          </button>
          <button onClick={() => markAll(false)} disabled={rows.length === 0} className="btn-ghost px-4 py-2 text-sm">
            Clear all
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="field sm:max-w-sm"
          placeholder="Search by name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search students"
        />
        <button
          onClick={save}
          disabled={busy || !dirty || rows.length === 0}
          className="btn-primary"
        >
          {busy ? 'Saving' : 'Save attendance'}
        </button>
      </div>

      {dirty && !busy && <p className="mt-6 text-sm text-brand-muted">You have unsaved changes.</p>}
      {error && <p className="mt-6 text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-6 text-sm text-brand-success">{notice}</p>}

      {rows.length === 0 && !error && (
        <p className="mt-10 text-brand-muted">No paying students for this session yet.</p>
      )}
      {rows.length > 0 && visible.length === 0 && (
        <p className="mt-10 text-brand-muted">No students match that search.</p>
      )}

      <div className="mt-8 divide-y divide-brand-border border-t border-brand-border">
        {visible.map((r) => (
          <label key={r.student_id} className="flex cursor-pointer items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="font-medium text-brand-text">{r.name}</p>
              <p className="mt-1 text-sm text-brand-muted">
                {r.phone ?? 'No phone'}
                {!r.marked_at && ' · Not yet marked'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={present.has(r.student_id)}
              onChange={() => toggle(r.student_id)}
              className="h-5 w-5 shrink-0 accent-brand-primary"
              aria-label={`${r.name} attended`}
            />
          </label>
        ))}
      </div>
    </section>
  )
}