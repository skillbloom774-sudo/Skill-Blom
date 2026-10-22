import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { callFunction, refundPurchase } from '../lib/payments'
import { formatNaira, formatSessionTime } from '../lib/sessions'

type Student = {
  purchase_id: string
  student_id: string
  name: string
  phone: string | null
  email: string | null
  amount_paid_kobo: number
  paid_at: string | null
}

const MAX_EMAIL_BATCH = 50

export default function SessionStudentsPanel({ sessionId }: { sessionId: string }) {
  const [students, setStudents] = useState<Student[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<'email' | 'refund' | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false

    supabase.rpc('session_paid_students', { p_session_id: sessionId }).then(({ data, error }) => {
      if (ignore) return
      if (error) {
        setError(error.message)
        return
      }
      setStudents((data as Student[]) ?? [])
    })

    return () => {
      ignore = true
    }
  }, [sessionId, reloadKey])

  const chosen = useMemo(
    () => (students ?? []).filter((s) => selected.has(s.purchase_id)),
    [students, selected],
  )
  const allChecked = !!students && students.length > 0 && chosen.length === students.length

  function toggleOne(purchaseId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(purchaseId)) next.delete(purchaseId)
      else next.add(purchaseId)
      return next
    })
  }

  function toggleAll() {
    if (!students) return
    setSelected(allChecked ? new Set() : new Set(students.map((s) => s.purchase_id)))
  }

  async function sendEmail(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (chosen.length === 0) {
      setError('Tick at least one student.')
      return
    }
    if (chosen.length > MAX_EMAIL_BATCH) {
      setError(`Email up to ${MAX_EMAIL_BATCH} students at a time. Untick some, then send again.`)
      return
    }
    if (!subject.trim() || !message.trim()) {
      setError('Add a subject and a message.')
      return
    }
    if (!confirm(`Send this email to ${chosen.length} ${chosen.length === 1 ? 'student' : 'students'}?`)) return

    setBusy('email')
    const { data, error } = await callFunction<{ sent: number; failed: number }>('session-email', {
      session_id: sessionId,
      subject: subject.trim(),
      message: message.trim(),
      purchase_ids: chosen.map((s) => s.purchase_id),
    })
    setBusy(null)

    if (error) {
      setError(error)
      return
    }

    const sent = data?.sent ?? 0
    const failed = data?.failed ?? 0
    setNotice(
      `Sent to ${sent} ${sent === 1 ? 'student' : 'students'}${failed > 0 ? `, ${failed} could not be sent` : ''}.`,
    )
    setSubject('')
    setMessage('')
  }

  async function refundStudents(list: Student[]) {
    if (list.length === 0) {
      setError('Tick at least one student to refund.')
      return
    }

    const label = list.length === 1 ? list[0].name : `${list.length} students`
    if (!confirm(`Refund ${label}? Their money goes back through Paystack and their access ends.`)) return

    setBusy('refund')
    setError(null)
    setNotice(null)

    const failures: string[] = []
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      setProgress(`Refunding ${i + 1} of ${list.length}`)
      const { error } = await refundPurchase(s.purchase_id, 'Refund issued by Skillbloom')
      if (error) failures.push(`${s.name}: ${error}`)
    }

    setProgress(null)
    setBusy(null)
    setSelected(new Set())

    if (failures.length > 0) {
      setError(`Some refunds did not go through:\n${failures.join('\n')}`)
    } else {
      setNotice(`Refunded ${label}. Each student has been emailed.`)
    }
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="card mt-14 sm:max-w-4xl">
      <p className="eyebrow">Students</p>
      <h2 className="mt-2 text-xl">Paying students</h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">
        Tick the students you want to email or refund. Refunds go back through Paystack, and the student's access
        ends.
      </p>

      {error && <p className="mt-6 whitespace-pre-line text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-6 text-sm text-brand-success">{notice}</p>}
      {progress && <p className="mt-6 text-sm text-brand-muted">{progress}</p>}

      {students === null && !error && <p className="mt-6 text-brand-muted">Loading students</p>}

      {students !== null && students.length === 0 && (
        <p className="mt-6 text-brand-muted">No paying students for this session yet.</p>
      )}

      {students !== null && students.length > 0 && (
        <>
          <div className="mt-6 flex items-center justify-between gap-4 border-b border-brand-border pb-4">
            <label className="flex items-center gap-3 text-sm text-brand-text">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="h-4 w-4 accent-brand-primary"
              />
              Select all ({students.length})
            </label>
            <p className="text-sm text-brand-muted">{chosen.length} selected</p>
          </div>

          <div className="divide-y divide-brand-border">
            {students.map((s) => (
              <div key={s.purchase_id} className="flex items-center gap-4 py-4">
                <input
                  type="checkbox"
                  checked={selected.has(s.purchase_id)}
                  onChange={() => toggleOne(s.purchase_id)}
                  className="h-4 w-4 shrink-0 accent-brand-primary"
                  aria-label={`Select ${s.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-brand-text">{s.name}</p>
                  <p className="mt-1 truncate text-sm text-brand-muted">
                    {s.email ?? 'No email'} · {s.phone ?? 'No phone'}
                  </p>
                  <p className="mt-1 text-xs text-brand-muted">
                    {formatNaira(s.amount_paid_kobo)}
                    {s.paid_at && <> · Paid {formatSessionTime(s.paid_at).day}</>}
                  </p>
                </div>
                <button
                  onClick={() => refundStudents([s])}
                  disabled={busy !== null}
                  className="shrink-0 text-sm text-brand-error hover:underline disabled:opacity-50"
                >
                  Refund
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={sendEmail} className="mt-10 grid gap-5 border-t border-brand-border pt-8">
            <p className="eyebrow">Email selected students</p>

            <div>
              <label className="label" htmlFor="se-subject">Subject</label>
              <input
                id="se-subject"
                className="field"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Change to the meeting link"
                maxLength={150}
              />
            </div>

            <div>
              <label className="label" htmlFor="se-message">Message</label>
              <textarea
                id="se-message"
                className="field min-h-32"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message in plain text"
                maxLength={5000}
              />
              <p className="mt-1.5 text-xs text-brand-muted">
                Sent to each ticked student's login email. Up to {MAX_EMAIL_BATCH} students at a time.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy !== null || chosen.length === 0}
                className="btn-primary"
              >
                {busy === 'email' ? 'Sending' : `Email ${chosen.length} selected`}
              </button>
              <button
                type="button"
                onClick={() => refundStudents(chosen)}
                disabled={busy !== null || chosen.length === 0}
                className="rounded-xl border border-brand-error px-5 py-3 text-[15px] font-medium text-brand-error transition hover:bg-brand-error/10 disabled:opacity-40"
              >
                {busy === 'refund' ? 'Refunding' : `Refund ${chosen.length} selected`}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}