import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatNaira, formatSessionTime } from '../../lib/sessions'
import { refundPurchase } from '../../lib/payments'

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  created_at: string
  role: string
}

type Purchase = {
  id: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  amount_paid_kobo: number
  paid_at: string | null
  access_ends_at: string | null
  created_at: string
  reference: string
  session_title: string
}

type Refund = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  created_at: string
  decided_at: string | null
  session_title: string
}

type Detail = {
  profile: Profile | null
  email: string | null
  purchases: Purchase[]
  refunds: Refund[]
}

const PURCHASE_PILL: Record<Purchase['status'], string> = {
  paid: 'bg-brand-success/10 text-brand-success',
  refunded: 'bg-brand-border/60 text-brand-muted',
  pending: 'bg-brand-accent-soft text-brand-accent',
  failed: 'bg-brand-error/10 text-brand-error',
}

const REFUND_PILL: Record<Refund['status'], string> = {
  pending: 'bg-brand-accent-soft text-brand-accent',
  approved: 'bg-brand-border/60 text-brand-muted',
  rejected: 'bg-brand-error/10 text-brand-error',
}

function day(iso: string) {
  return formatSessionTime(iso).day
}

export default function AdminStudentDetail() {
  const { id } = useParams()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let ignore = false

    supabase.rpc('student_detail', { p_student_id: id }).then(({ data, error }) => {
      if (ignore) return
      if (error) {
        setError(error.message)
      } else {
        setDetail(data as Detail)
      }
      setLoaded(true)
    })

    return () => {
      ignore = true
    }
  }, [id, reloadKey])

  async function refund(p: Purchase) {
    if (!confirm(`Refund ${detail?.profile?.full_name ?? 'this student'} for ${p.session_title}? Their access ends.`)) return
    setBusyId(p.id)
    setError(null)
    setNotice(null)
    const { error } = await refundPurchase(p.id, 'Refund issued by Skillbloom')
    setBusyId(null)
    if (error) {
      setError(error)
      return
    }
    setNotice('Refund issued. The student has been emailed.')
    setReloadKey((k) => k + 1)
  }

  if (!loaded) return <p className="container-page py-16 text-brand-muted">Loading student</p>

  if (error && !detail) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">Could not load this student</h1>
        <p className="mt-4 text-brand-error">{error}</p>
        <Link to="/admin/students" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to students
        </Link>
      </section>
    )
  }

  if (!detail?.profile) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">Student not found</h1>
        <Link to="/admin/students" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to students
        </Link>
      </section>
    )
  }

  const { profile, email, purchases, refunds } = detail
  const activeCount = purchases.filter(
    (p) => p.status === 'paid' && p.access_ends_at && new Date(p.access_ends_at) > new Date(),
  ).length
  const refundedCount = purchases.filter((p) => p.status === 'refunded').length
  const collected = purchases
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount_paid_kobo, 0)

  return (
    <section className="container-page py-14 sm:py-20">
      <Link to="/admin/students" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← All students
      </Link>

      <p className="eyebrow mt-8">Student</p>
      <h1 className="mt-3 text-4xl">{profile.full_name?.trim() || 'No name'}</h1>
      <p className="mt-3 text-brand-muted">
        {email ?? 'No email'} · {profile.phone ?? 'No phone'} · Joined {day(profile.created_at)}
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-4">
        <div className="card">
          <p className="eyebrow">Purchases</p>
          <p className="mt-4 font-serif text-3xl text-brand-text">{purchases.length}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Active access</p>
          <p className="mt-4 font-serif text-3xl text-brand-text">{activeCount}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Refunded</p>
          <p className="mt-4 font-serif text-3xl text-brand-text">{refundedCount}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Paid in total</p>
          <p className="mt-4 font-serif text-3xl text-brand-text">{formatNaira(collected)}</p>
        </div>
      </div>

      {error && <p className="mt-8 text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-8 text-sm text-brand-success">{notice}</p>}

      <div className="mt-14">
        <h2 className="text-2xl">Purchases</h2>
        {purchases.length === 0 && <p className="mt-4 text-brand-muted">This student has not bought anything yet.</p>}

        <div className="mt-5 divide-y divide-brand-border border-t border-brand-border">
          {purchases.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium text-brand-text">{p.session_title}</p>
                  <span className={`pill capitalize ${PURCHASE_PILL[p.status]}`}>{p.status}</span>
                </div>
                <p className="mt-1 text-sm text-brand-muted">
                  {formatNaira(p.amount_paid_kobo)}
                  {p.paid_at && <> · Paid {day(p.paid_at)}</>}
                  {p.access_ends_at && <> · Access until {day(p.access_ends_at)}</>}
                </p>
                <p className="mt-1 font-mono text-xs text-brand-muted">{p.reference}</p>
              </div>
              {p.status === 'paid' && (
                <button
                  onClick={() => refund(p)}
                  disabled={busyId === p.id}
                  className="shrink-0 text-sm text-brand-error hover:underline disabled:opacity-50"
                >
                  Refund
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-14">
        <h2 className="text-2xl">Refund requests</h2>
        {refunds.length === 0 && <p className="mt-4 text-brand-muted">No refund requests.</p>}

        <div className="mt-5 grid gap-4">
          {refunds.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-medium text-brand-text">{r.session_title}</p>
                <span className={`pill capitalize ${REFUND_PILL[r.status]}`}>{r.status}</span>
              </div>
              <p className="mt-1 text-xs text-brand-muted">
                Requested {day(r.created_at)}
                {r.decided_at && <> · Decided {day(r.decided_at)}</>}
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-brand-text">{r.reason}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-brand-muted">
          Pending refund requests are decided on the{' '}
          <Link to="/admin/payments" className="text-brand-primary underline">Payments</Link> page.
        </p>
      </div>
    </section>
  )
}