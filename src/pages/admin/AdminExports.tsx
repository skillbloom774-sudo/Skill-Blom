import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { downloadCsv, lagosDateTime, naira, type Column } from '../../lib/csv'
import { startOfDay, startOfNextDay } from '../../lib/adminFilters'
import PageHeader from '../../components/PageHeader'

type PaymentStatus = 'all' | 'paid' | 'refunded' | 'pending' | 'failed'
type RefundStatus = 'all' | 'pending' | 'approved' | 'rejected'

type PaymentRow = {
  created_at: string
  paid_at: string | null
  status: string
  student_name: string
  email: string
  phone: string
  session_title: string
  amount_paid_kobo: number
  paystack_reference: string
  card_id: string
}

type RefundRow = {
  created_at: string
  decided_at: string | null
  status: string
  student_name: string
  email: string
  phone: string
  session_title: string
  amount_paid_kobo: number
  paystack_reference: string
  reason: string
}

type StudentRow = {
  joined: string
  name: string
  email: string
  phone: string
  paid_sessions: number
  active_sessions: number
  refunded_sessions: number
}

const PAYMENT_STATUSES: PaymentStatus[] = ['all', 'paid', 'refunded', 'pending', 'failed']
const REFUND_STATUSES: RefundStatus[] = ['all', 'pending', 'approved', 'rejected']

const PAYMENT_COLUMNS: Column[] = [
  { key: 'started', label: 'Started' },
  { key: 'paid_on', label: 'Paid on' },
  { key: 'status', label: 'Status' },
  { key: 'student', label: 'Student' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'session', label: 'Session' },
  { key: 'amount', label: 'Amount (NGN)' },
  { key: 'reference', label: 'Paystack reference' },
  { key: 'card', label: 'Card ID' },
]

const REFUND_COLUMNS: Column[] = [
  { key: 'requested', label: 'Requested on' },
  { key: 'decided', label: 'Decided on' },
  { key: 'status', label: 'Status' },
  { key: 'student', label: 'Student' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'session', label: 'Session' },
  { key: 'amount', label: 'Amount (NGN)' },
  { key: 'reference', label: 'Paystack reference' },
  { key: 'reason', label: 'Reason' },
]

const STUDENT_COLUMNS: Column[] = [
  { key: 'joined', label: 'Joined' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'paid', label: 'Sessions paid' },
  { key: 'active', label: 'Active sessions' },
  { key: 'refunded', label: 'Refunded sessions' },
]

function toPaymentRecord(r: PaymentRow) {
  return {
    started: lagosDateTime(r.created_at),
    paid_on: lagosDateTime(r.paid_at),
    status: r.status,
    student: r.student_name,
    email: r.email,
    phone: r.phone,
    session: r.session_title,
    amount: naira(r.amount_paid_kobo),
    reference: r.paystack_reference,
    card: r.card_id,
  }
}

function toRefundRecord(r: RefundRow) {
  return {
    requested: lagosDateTime(r.created_at),
    decided: lagosDateTime(r.decided_at),
    status: r.status,
    student: r.student_name,
    email: r.email,
    phone: r.phone,
    session: r.session_title,
    amount: naira(r.amount_paid_kobo),
    reference: r.paystack_reference,
    reason: r.reason,
  }
}

function toStudentRecord(r: StudentRow) {
  return {
    joined: lagosDateTime(r.joined),
    name: r.name,
    email: r.email,
    phone: r.phone,
    paid: r.paid_sessions,
    active: r.active_sessions,
    refunded: r.refunded_sessions,
  }
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm capitalize transition ${
    active
      ? 'bg-brand-primary text-white'
      : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
  }`
}

export default function AdminExports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('all')
  const [refundStatus, setRefundStatus] = useState<RefundStatus>('all')
  const [busy, setBusy] = useState<'payments' | 'refunds' | 'students' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const stamp = new Date().toISOString().slice(0, 10)

  async function exportPayments() {
    setBusy('payments')
    setError(null)
    setNotice(null)

    const { data, error } = await supabase.rpc('export_payments', {
      p_status: paymentStatus === 'all' ? null : paymentStatus,
      p_from: startOfDay(from),
      p_to: startOfNextDay(to),
    })
    setBusy(null)

    if (error) {
      setError(error.message)
      return
    }

    const rows = (data as PaymentRow[]) ?? []
    downloadCsv(`payments-${stamp}`, PAYMENT_COLUMNS, rows.map(toPaymentRecord))
    setNotice(`Downloaded ${rows.length} ${rows.length === 1 ? 'payment' : 'payments'}.`)
  }

  async function exportRefunds() {
    setBusy('refunds')
    setError(null)
    setNotice(null)

    const { data, error } = await supabase.rpc('export_refunds', {
      p_status: refundStatus === 'all' ? null : refundStatus,
      p_from: startOfDay(from),
      p_to: startOfNextDay(to),
    })
    setBusy(null)

    if (error) {
      setError(error.message)
      return
    }

    const rows = (data as RefundRow[]) ?? []
    downloadCsv(`refund-requests-${stamp}`, REFUND_COLUMNS, rows.map(toRefundRecord))
    setNotice(`Downloaded ${rows.length} refund ${rows.length === 1 ? 'request' : 'requests'}.`)
  }

  async function exportStudents() {
    setBusy('students')
    setError(null)
    setNotice(null)

    const { data, error } = await supabase.rpc('export_students')
    setBusy(null)

    if (error) {
      setError(error.message)
      return
    }

    const rows = (data as StudentRow[]) ?? []
    downloadCsv(`students-${stamp}`, STUDENT_COLUMNS, rows.map(toStudentRecord))
    setNotice(`Downloaded ${rows.length} ${rows.length === 1 ? 'student' : 'students'}.`)
  }

  const datesSet = Boolean(from || to)

  return (
    <section className="container-page py-14 sm:py-20">
      <PageHeader
        eyebrow="Admin"
        title="Exports"
        description="Download records as spreadsheets for your own files, accounts, or tax records. Each file opens in Excel or Google Sheets."
      />

      <div className="card mt-10 grid gap-6 sm:max-w-3xl">
        <p className="eyebrow">Date range</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ex-from">From</label>
            <input id="ex-from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ex-to">To</label>
            <input id="ex-to" type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-brand-muted">
          Payments are matched by the date the purchase started. Refund requests are matched by the date requested.
          Leave both dates empty to export everything.
        </p>
        {datesSet && (
          <button
            type="button"
            onClick={() => {
              setFrom('')
              setTo('')
            }}
            className="w-fit text-sm text-brand-muted hover:text-brand-primary"
          >
            Clear dates
          </button>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card">
          <p className="eyebrow">Payments</p>
          <h2 className="mt-2 text-xl">Every payment</h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            Student, session, amount, status, and Paystack reference. Use it to match payments against Paystack.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {PAYMENT_STATUSES.map((s) => (
              <button key={s} onClick={() => setPaymentStatus(s)} className={chipClass(paymentStatus === s)}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={exportPayments} disabled={busy !== null} className="btn-primary mt-6">
            {busy === 'payments' ? 'Preparing' : 'Download payments'}
          </button>
        </div>

        <div className="card">
          <p className="eyebrow">Refunds</p>
          <h2 className="mt-2 text-xl">Refund requests</h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            Each request with the student, session, amount, the reason given, and the decision and its date.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {REFUND_STATUSES.map((s) => (
              <button key={s} onClick={() => setRefundStatus(s)} className={chipClass(refundStatus === s)}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={exportRefunds} disabled={busy !== null} className="btn-primary mt-6">
            {busy === 'refunds' ? 'Preparing' : 'Download refund requests'}
          </button>
        </div>

        <div className="card">
          <p className="eyebrow">Students</p>
          <h2 className="mt-2 text-xl">Every student</h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            Contact details, when they joined, and how many sessions they have paid for, are active, or were refunded.
          </p>
          <button onClick={exportStudents} disabled={busy !== null} className="btn-primary mt-6">
            {busy === 'students' ? 'Preparing' : 'Download students'}
          </button>
        </div>
      </div>

      {error && <p className="mt-8 text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-8 text-sm text-brand-success">{notice}</p>}
    </section>
  )
}