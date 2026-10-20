import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { refundPurchase } from '../lib/payments'
import { formatNaira } from '../lib/sessions'

type Person = { full_name: string | null; phone: string | null } | null
type PaidRow = { id: string; amount_paid_kobo: number; profiles: Person }

function nameOf(p: Person) {
  return p?.full_name?.trim() || 'Student'
}

export default function CancelSessionPanel({ sessionId }: { sessionId: string }) {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('')
  const [paid, setPaid] = useState<PaidRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false

    Promise.all([
      supabase.from('sessions').select('status, title').eq('id', sessionId).maybeSingle(),
      supabase
        .from('purchases')
        .select('id, amount_paid_kobo, profiles(full_name, phone)')
        .eq('session_id', sessionId)
        .eq('status', 'paid')
        .order('paid_at'),
    ]).then(([s, p]) => {
      if (ignore) return
      setStatus(s.data?.status ?? '')
      setTitle(s.data?.title ?? '')
      setPaid((p.data as unknown as PaidRow[]) ?? [])
      setLoaded(true)
    })

    return () => {
      ignore = true
    }
  }, [sessionId, reloadKey])

  async function setSessionStatus(next: 'cancelled' | 'draft') {
    setError(null)
    setNotice(null)
    const { error } = await supabase.from('sessions').update({ status: next }).eq('id', sessionId)
    if (error) {
      setError(error.message)
      return
    }
    setNotice(
      next === 'cancelled'
        ? 'Session cancelled. Students no longer see it in listings.'
        : 'Session reopened as a draft.',
    )
    setReloadKey((k) => k + 1)
  }

  async function refundOne(row: PaidRow) {
    if (!confirm(`Refund ${nameOf(row.profiles)}? Their money goes back and their access ends.`)) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error } = await refundPurchase(row.id, 'Refund issued by Skillbloom')
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    setNotice(`${nameOf(row.profiles)} has been refunded.`)
    setReloadKey((k) => k + 1)
  }

  async function cancelAndRefundAll() {
    if (
      !confirm(
        `Cancel "${title}" and refund all ${paid.length} paying student(s)? This cannot be undone.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)
    setNotice(null)

    if (status !== 'cancelled') {
      const { error: statusError } = await supabase
        .from('sessions')
        .update({ status: 'cancelled' })
        .eq('id', sessionId)
      if (statusError) {
        setBusy(false)
        setError(statusError.message)
        return
      }
    }

    // One at a time, so each refund is confirmed before the next starts
    const failures: string[] = []
    for (let i = 0; i < paid.length; i++) {
      const row = paid[i]
      setProgress(`Refunding ${i + 1} of ${paid.length}`)
      const { error: refundError } = await refundPurchase(row.id, 'Session cancelled')
      if (refundError) failures.push(`${nameOf(row.profiles)}: ${refundError}`)
    }

    setProgress(null)
    setBusy(false)

    if (failures.length > 0) {
      setError(`Some refunds did not go through:\n${failures.join('\n')}`)
    } else {
      setNotice('Every paying student has been refunded and emailed.')
    }
    setReloadKey((k) => k + 1)
  }

  if (!loaded) return null

  return (
    <div className="card mt-14 sm:max-w-3xl">
      <p className="eyebrow">Cancel or refund</p>
      <h2 className="mt-2 text-xl">Session status: {status}</h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">
        Cancelling hides the session from students. Refunding a student sends their money back through
        Paystack and ends their access to this session.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {status !== 'cancelled' ? (
          <button onClick={() => setSessionStatus('cancelled')} disabled={busy} className="btn-ghost">
            Cancel session
          </button>
        ) : (
          <button onClick={() => setSessionStatus('draft')} disabled={busy} className="btn-ghost">
            Reopen as draft
          </button>
        )}
        {paid.length > 0 && (
          <button
            onClick={cancelAndRefundAll}
            disabled={busy}
            className="rounded-xl border border-brand-error px-5 py-3 text-[15px] font-medium text-brand-error transition hover:bg-brand-error/10 disabled:opacity-50"
          >
            Refund all {paid.length}
          </button>
        )}
      </div>

      {progress && <p className="mt-4 text-sm text-brand-muted">{progress}</p>}
      {notice && <p className="mt-4 text-sm text-brand-success">{notice}</p>}
      {error && <p className="mt-4 whitespace-pre-line text-sm text-brand-error">{error}</p>}

      <div className="mt-8 divide-y divide-brand-border border-t border-brand-border">
        {paid.length === 0 && <p className="py-5 text-sm text-brand-muted">No paying students for this session.</p>}
        {paid.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium text-brand-text">{nameOf(row.profiles)}</p>
              <p className="text-sm text-brand-muted">
                {row.profiles?.phone ?? 'No phone'} · {formatNaira(row.amount_paid_kobo)}
              </p>
            </div>
            <button
              onClick={() => refundOne(row)}
              disabled={busy}
              className="text-sm text-brand-error hover:underline disabled:opacity-50"
            >
              Refund
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}