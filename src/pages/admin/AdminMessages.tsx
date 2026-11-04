import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { formatNaira } from '../../lib/sessions'

type Student = {
  id: string
  name: string
  phone: string
  email: string
  opted_in: boolean
  paid_sessions: number
}

type Code = {
  code: string
  kind: 'percent' | 'fixed'
  amount: number
  expires_at: string | null
  max_uses: number | null
  uses: number
}

const MAX = 50

export default function AdminMessages() {
  const [params] = useSearchParams()
  const preselect = params.get('student')

  const [students, setStudents] = useState<Student[] | null>(null)
  const [codes, setCodes] = useState<Code[]>([])
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'message' | 'discount'>('message')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(preselect ? [preselect] : []))
  const [codeChoice, setCodeChoice] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

    // Once the student list has loaded, tick the student from the link, if there is one
 
  useEffect(() => {
    let ignore = false
    Promise.all([
      supabase.functions.invoke('admin-messages', { body: { action: 'list' } }),
      supabase.functions.invoke('admin-messages', { body: { action: 'codes' } }),
    ]).then(([listRes, codeRes]) => {
      if (ignore) return
      if (listRes.error) setError('Students could not be loaded. Refresh the page to try again.')
      setStudents((listRes.data?.students as Student[]) ?? [])
      setCodes((codeRes.data?.codes as Code[]) ?? [])
    })
    return () => {
      ignore = true
    }
  }, [])

  // In discount mode only students who opted in can be chosen
  const eligible = (s: Student) => (mode === 'discount' ? s.opted_in : true)

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (students ?? []).filter(
      (s) => !term || s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || s.phone.includes(term),
    )
  }, [students, search])

  const usableCodes = codes.filter((c) => !c.expires_at || new Date(c.expires_at) > new Date())

  function toggle(id: string, s: Student) {
    if (!eligible(s)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectVisible() {
    const ids = visible.filter(eligible).map((s) => s.id).slice(0, MAX)
    setSelected(new Set(ids))
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const ids = Array.from(selected)
    if (ids.length === 0) return setError('Choose at least one student.')
    if (ids.length > MAX) return setError(`Send to up to ${MAX} students at a time. Untick some and send again.`)
    if (mode === 'discount' && !codeChoice) return setError('Choose a discount code.')
    if (!subject.trim() || !message.trim()) return setError('Add a subject and a message.')
    if (!confirm(`Send this to ${ids.length} ${ids.length === 1 ? 'student' : 'students'}?`)) return

    setBusy(true)
    const { data, error } = await supabase.functions.invoke('admin-messages', {
      body: {
        action: 'send',
        mode,
        recipient_ids: ids,
        code: mode === 'discount' ? codeChoice : undefined,
        subject: subject.trim(),
        message: message.trim(),
      },
    })
    setBusy(false)

    if (error) {
      const body = await (error as { context?: Response }).context?.json().catch(() => null)
      setError(body?.error ?? 'Could not send. Try again.')
      return
    }

    setResult(`Sent to ${data.sent}. Failed: ${data.failed}. Skipped: ${data.skipped}.`)
    setSelected(new Set())
    setSubject('')
    setMessage('')
  }

  const selectedCount = selected.size

  return (
    <section className="container-page py-14 sm:py-20">
      <PageHeader
        eyebrow="Admin"
        title="Messages"
        description="Send a message to signed-up students, or send a discount code to students who chose to hear about offers."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="card">
          <p className="eyebrow">Students</p>
          <input
            className="field mt-4"
            placeholder="Search by name, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <button onClick={selectVisible} className="text-brand-primary hover:underline">
              Select shown
            </button>
            <button onClick={() => setSelected(new Set())} className="text-brand-muted hover:underline">
              Clear
            </button>
            <span className="text-brand-muted">{selectedCount} selected</span>
          </div>

          {students === null && <p className="mt-6 text-brand-muted">Loading students</p>}

          <div className="mt-4 max-h-[460px] divide-y divide-brand-border overflow-y-auto border-t border-brand-border">
            {visible.map((s) => {
              const allowed = eligible(s)
              return (
                <label
                  key={s.id}
                  className={`flex items-start gap-3 py-3 ${allowed ? 'cursor-pointer' : 'opacity-50'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-brand-primary"
                    checked={selected.has(s.id)}
                    disabled={!allowed}
                    onChange={() => toggle(s.id, s)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-brand-text">{s.name}</span>
                    <span className="block truncate text-xs text-brand-muted">{s.email}</span>
                    <span className="mt-1 block text-xs text-brand-muted">
                      {s.paid_sessions} paid {s.paid_sessions === 1 ? 'session' : 'sessions'}
                      {!s.opted_in && ' · not opted in to offers'}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <form onSubmit={send} className="card grid content-start gap-5">
          <p className="eyebrow">Message</p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('message')}
              className={mode === 'message' ? 'btn-primary' : 'btn-ghost'}
            >
              Send a message
            </button>
            <button
              type="button"
              onClick={() => setMode('discount')}
              className={mode === 'discount' ? 'btn-primary' : 'btn-ghost'}
            >
              Send a discount code
            </button>
          </div>

          {mode === 'discount' && (
            <div>
              <label className="label" htmlFor="msg-code">Discount code</label>
              <select
                id="msg-code"
                className="field"
                value={codeChoice}
                onChange={(e) => setCodeChoice(e.target.value)}
              >
                <option value="">Choose a code</option>
                {usableCodes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.kind === 'percent' ? `${c.amount}% off` : `${formatNaira(c.amount)} off`}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-brand-muted">
                Only students who ticked the offers box at sign-up are shown as selectable.
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="msg-subject">Subject</label>
            <input
              id="msg-subject"
              className="field"
              maxLength={150}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="msg-body">Message</label>
            <textarea
              id="msg-body"
              className="field min-h-40"
              maxLength={5000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="mt-2 text-xs text-brand-muted">
              Write in plain text. A blank line starts a new paragraph. Up to {MAX} students per send.
            </p>
          </div>

          {error && <p className="text-sm text-brand-error">{error}</p>}
          {result && <p className="text-sm text-brand-success">{result}</p>}

          <div>
            <button type="submit" disabled={busy || selectedCount === 0} className="btn-primary">
              {busy ? 'Sending' : `Send to ${selectedCount} ${selectedCount === 1 ? 'student' : 'students'}`}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}