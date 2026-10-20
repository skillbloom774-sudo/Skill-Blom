import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import CancelSessionPanel from '../../components/CancelSessionPanel'

type Option = { id: string; name: string }

function toInputValue(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-brand-muted">{hint}</p>}
    </div>
  )
}

export default function AdminSessionEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [sections, setSections] = useState<Option[]>([])
  const [teachers, setTeachers] = useState<Option[]>([])

  const [sectionId, setSectionId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [accessEndsAt, setAccessEndsAt] = useState('')
  const [priceNaira, setPriceNaira] = useState('')
  const [limit, setLimit] = useState('')
  const [status, setStatus] = useState<'draft' | 'published' | 'cancelled'>('draft')

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!id) return
    let ignore = false

    Promise.all([
      supabase.from('sections').select('id, name').order('name'),
      supabase.from('guest_teachers').select('id, name').order('name'),
      supabase
        .from('sessions')
        .select(
          'section_id, guest_teacher_id, title, description, starts_at, ends_at, access_ends_at, price_kobo, enrollment_limit, status',
        )
        .eq('id', id)
        .maybeSingle(),
    ]).then(([secRes, teacherRes, sessRes]) => {
      if (ignore) return
      setSections(secRes.data ?? [])
      setTeachers(teacherRes.data ?? [])

      const s = sessRes.data
      if (!s) {
        setNotFound(true)
        return
      }

      setSectionId(s.section_id)
      setTeacherId(s.guest_teacher_id ?? '')
      setTitle(s.title)
      setDescription(s.description ?? '')
      setStartsAt(toInputValue(s.starts_at))
      setEndsAt(toInputValue(s.ends_at))
      setAccessEndsAt(toInputValue(s.access_ends_at))
      setPriceNaira(String(s.price_kobo / 100))
      setLimit(s.enrollment_limit ? String(s.enrollment_limit) : '')
      setStatus(s.status)
      setLoaded(true)
    })

    return () => {
      ignore = true
    }
  }, [id])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setMessage(null)

    const start = new Date(startsAt)
    const end = new Date(endsAt)
    const access = new Date(accessEndsAt)

    if (end <= start) {
      setMessage({ type: 'error', text: 'The end time must be after the start time.' })
      return
    }
    if (access < end) {
      setMessage({
        type: 'error',
        text: 'Access must last until at least the session ends. Set Access ends to a later time.',
      })
      return
    }

    const priceKobo = Math.round(Number(priceNaira) * 100)
    if (!Number.isFinite(priceKobo) || priceKobo < 0) {
      setMessage({ type: 'error', text: 'Enter a valid price in naira.' })
      return
    }

    setBusy(true)

    const { error } = await supabase
      .from('sessions')
      .update({
        section_id: sectionId,
        guest_teacher_id: teacherId || null,
        title,
        description: description || null,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        access_ends_at: access.toISOString(),
        price_kobo: priceKobo,
        enrollment_limit: limit ? Number(limit) : null,
        status,
      })
      .eq('id', id)

    setBusy(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: 'Saved.' })
  }

  if (notFound) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">Session not found</h1>
        <Link to="/admin/sessions" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to sessions
        </Link>
      </section>
    )
  }

  if (!loaded) {
    return <p className="container-page py-16 text-brand-muted">Loading session</p>
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <button
        onClick={() => navigate('/admin/sessions')}
        className="text-sm text-brand-muted transition hover:text-brand-primary"
      >
        ← Back to sessions
      </button>

      <p className="eyebrow mt-8">Admin</p>
      <h1 className="mt-3 text-4xl">Edit session</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        The Zoom or Google Meet link is added by the guest teacher from their teaching area.
      </p>

      <form onSubmit={handleSave} className="card mt-10 grid gap-6 sm:max-w-3xl">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="e-section" label="Section">
            <select
              id="e-section"
              className="field"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              required
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field id="e-teacher" label="Guest teacher">
            <select
              id="e-teacher"
              className="field"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">No teacher yet</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="e-title" label="Session title">
          <input
            id="e-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Field>

        <Field id="e-desc" label="Description">
          <textarea
            id="e-desc"
            className="field min-h-28"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="e-start" label="Starts">
            <input
              id="e-start"
              type="datetime-local"
              className="field"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </Field>
          <Field id="e-end" label="Ends">
            <input
              id="e-end"
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
          <Field
            id="e-access"
            label="Access ends"
            hint="Students keep access until this time. It must be after the session ends."
          >
            <input
              id="e-access"
              type="datetime-local"
              className="field"
              min={endsAt || undefined}
              value={accessEndsAt}
              onChange={(e) => setAccessEndsAt(e.target.value)}
              required
            />
          </Field>
          <Field id="e-price" label="Price (₦)">
            <input
              id="e-price"
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
          <Field id="e-limit" label="Enrollment limit (optional)">
            <input
              id="e-limit"
              type="number"
              min="1"
              className="field"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </Field>
          <Field id="e-status" label="Status">
            <select
              id="e-status"
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="draft">Draft (hidden from students)</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'ok' ? 'text-brand-success' : 'text-brand-error'}`}>
            {message.text}
          </p>
        )}

        <div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving' : 'Save changes'}
          </button>
        </div>
      </form>

      <CancelSessionPanel sessionId={id!} />
    </section>
  )
}