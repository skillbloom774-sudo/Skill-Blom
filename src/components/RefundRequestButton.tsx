import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

type Status = 'pending' | 'approved' | 'rejected'

const LABEL: Record<Status, { text: string; className: string }> = {
  pending: { text: 'Refund requested', className: 'bg-brand-accent-soft text-brand-accent' },
  approved: { text: 'Refunded', className: 'bg-brand-border/60 text-brand-muted' },
  rejected: { text: 'Refund declined', className: 'bg-brand-error/10 text-brand-error' },
}

export default function RefundRequestButton({
  purchaseId,
  startsAt,
}: {
  purchaseId: string
  startsAt: string
}) {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Students can ask for a refund only before the session starts
  const beforeStart = new Date(startsAt) > new Date()

  useEffect(() => {
    if (!user || !beforeStart) return
    let ignore = false

    supabase
      .from('refund_requests')
      .select('status')
      .eq('purchase_id', purchaseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (ignore) return
        setStatus((data?.status as Status) ?? null)
        setLoaded(true)
      })

    return () => {
      ignore = true
    }
  }, [purchaseId, user, beforeStart, reloadKey])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    if (reason.trim().length < 5) {
      setError('Tell us a little about why you want a refund.')
      return
    }

    setBusy(true)
    const { error } = await supabase.from('refund_requests').insert({
      purchase_id: purchaseId,
      student_id: user.id,
      reason: reason.trim(),
    })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    setOpen(false)
    setReason('')
    setReloadKey((k) => k + 1)
  }

  if (!beforeStart || !loaded) return null

  if (status) {
    return <span className={`pill ${LABEL[status].className}`}>{LABEL[status].text}</span>
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-brand-muted underline-offset-4 transition hover:text-brand-error hover:underline"
      >
        Request refund
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="grid w-full gap-3 sm:w-80">
      <textarea
        className="field min-h-24"
        placeholder="Tell us why you want a refund"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <p className="text-sm text-brand-error">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-sm">
          {busy ? 'Sending' : 'Send request'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}