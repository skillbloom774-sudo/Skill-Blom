import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { PURCHASE_SELECT, getPurchaseState, type Purchase, type PurchaseState } from '../lib/purchases'
import { formatSessionTime } from '../lib/sessions'
import PageHeader from '../components/PageHeader'

const STATE_TEXT: Record<PurchaseState, { label: string; tone: string }> = {
  upcoming: { label: 'Upcoming', tone: 'text-brand-primary' },
  live: { label: 'Live now', tone: 'text-brand-success' },
  ended: { label: 'Active until month end', tone: 'text-brand-success' },
  expired: { label: 'Expired', tone: 'text-brand-error' },
}

export default function AccessCard() {
  const { cardId } = useParams()
  const { user, loading } = useAuth()
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!cardId || !user) return
    let ignore = false

    supabase
      .from('purchases')
      .select(PURCHASE_SELECT)
      .eq('card_id', cardId)
      .eq('status', 'paid')
      .maybeSingle()
      .then(({ data }) => {
        if (ignore) return
        setPurchase((data as unknown as Purchase) ?? null)
        setLoaded(true)
      })

    return () => {
      ignore = true
    }
  }, [cardId, user])

  if (loading) return <p className="container-page py-16 text-brand-muted">Loading</p>
  if (!user) return <Navigate to="/login" replace />
  if (!loaded) return <p className="container-page py-16 text-brand-muted">Loading card</p>

  if (!purchase || !purchase.sessions) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">This card isn't available</h1>
        <Link to="/dashboard" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to dashboard
        </Link>
      </section>
    )
  }

  const session = purchase.sessions
  const state = getPurchaseState(purchase)
  const status = STATE_TEXT[state]
  const verifyUrl = `${window.location.origin}/verify/${purchase.card_id}`
  const validUntil = purchase.access_ends_at ? formatSessionTime(purchase.access_ends_at).day : '—'
  const holder = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Student'

  return (
    <section className="container-page py-12 sm:py-16">
      <Link to="/dashboard" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← Dashboard
      </Link>

      <div className="mx-auto mt-10 max-w-2xl">
        <PageHeader
          eyebrow="Access card"
          title="Your card"
          description="Show this card or scan the code to confirm your access."
        />

        <div className="mt-10 overflow-hidden rounded-3xl border border-brand-border bg-brand-surface shadow-card">
          <div className="bg-brand-primary p-8 text-white sm:p-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="" className="h-9 w-9" />
                <span className="font-serif text-xl">Skillbloom</span>
              </div>
              <span className="text-xs uppercase tracking-[0.18em] text-white/70">Access card</span>
            </div>
            <p className="mt-10 text-sm text-white/70">{session.sections?.name}</p>
            <p className="mt-1 font-serif text-3xl leading-tight">{session.title}</p>
            {session.guest_teachers && (
              <p className="mt-2 text-sm text-white/75">with {session.guest_teachers.name}</p>
            )}
          </div>

          <div className="grid gap-8 p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
            <div className="grid gap-6">
              <div>
                <p className="eyebrow">Holder</p>
                <p className="mt-2 text-lg font-medium text-brand-text">{holder}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="eyebrow">Valid until</p>
                  <p className="mt-2 text-sm text-brand-text">{validUntil}</p>
                </div>
                <div>
                  <p className="eyebrow">Status</p>
                  <p className={`mt-2 text-sm font-medium ${status.tone}`}>{status.label}</p>
                </div>
              </div>
              <div>
                <p className="eyebrow">Card ID</p>
                <p className="mt-2 font-mono text-sm tracking-widest text-brand-text">{purchase.card_id}</p>
              </div>
            </div>

            <div className="mx-auto rounded-2xl border border-brand-border bg-white p-4 text-center">
              <QRCodeSVG value={verifyUrl} size={128} fgColor="#1B2A4A" level="M" />
              <p className="mt-3 text-xs text-brand-muted">Scan to verify</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <p className="text-sm text-brand-muted">Keep a copy on your phone, or save it as a PDF.</p>
          <button onClick={() => window.print()} className="btn-ghost">
            Save as PDF
          </button>
        </div>
      </div>
    </section>
  )
}