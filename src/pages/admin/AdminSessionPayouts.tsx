import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNaira, formatSessionTime } from '../../lib/sessions'
import PageHeader from '../../components/PageHeader'

type Role = 'admin' | 'developer' | 'teacher'

type Transfer = {
  reference: string
  amount_kobo: number
  status: 'success' | 'pending' | 'failed' | 'otp_required'
  message: string
  account_name: string
  bank_name: string
  account_last4: string
}

type Payout = {
  status: 'draft' | 'otp_sent' | 'sending' | 'sent' | 'partial'
  pool_kobo: number
  skillbloom_kobo: number
  admin_kobo: number
  developer_kobo: number
  teacher_kobo: number
  paid_count: number
  transfers: Partial<Record<Role, Transfer>>
  sent_at: string | null
} | null

type SessionRow = {
  id: string
  title: string
  section: string
  teacher: string | null
  ends_at: string
  paid_count: number
  gross_kobo: number
  payout: Payout
  missing: Role[]
}

type Overview = { mode: 'live' | 'test'; sessions: SessionRow[] }

const STATUS_TEXT: Record<string, string> = {
  none: 'Not prepared',
  draft: 'Prepared, not sent',
  otp_sent: 'Code sent, waiting for confirmation',
  sending: 'Sending money',
  sent: 'Sent',
  partial: 'Needs attention',
}

const STATUS_CLASS: Record<string, string> = {
  none: 'bg-brand-border/60 text-brand-muted',
  draft: 'bg-brand-accent-soft text-brand-accent',
  otp_sent: 'bg-brand-accent-soft text-brand-accent',
  sending: 'bg-brand-accent-soft text-brand-accent',
  sent: 'bg-brand-success/10 text-brand-success',
  partial: 'bg-brand-error/10 text-brand-error',
}

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', developer: 'Developer', teacher: 'Teacher' }

async function readError(error: unknown) {
  const body = await (error as { context?: Response }).context?.json().catch(() => null)
  return (body?.error as string | undefined) ?? 'Something went wrong. Try again.'
}

function SessionPayoutCard({ s, onChanged }: { s: SessionRow; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const payout = s.payout
  const status = payout?.status ?? 'none'
  const canPrepare = !payout || payout.status === 'draft' || payout.status === 'otp_sent'
  const canSendCode = !!payout && ['draft', 'otp_sent', 'partial'].includes(payout.status) && s.missing.length === 0
  const hasPending = Object.values(payout?.transfers ?? {}).some((t) => t?.status === 'pending')

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action)
    setError(null)
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('session-payouts', {
      body: { action, session_id: s.id, ...extra },
    })
    setBusy(null)

    if (error) {
      setError(await readError(error))
      return
    }

    const d = data as { sent_to?: string; status?: string } | null
    if (action === 'prepare') setMessage('Split prepared. Check the amounts, then send the code.')
    if (action === 'request_otp') setMessage(`A 6-digit code was sent to ${d?.sent_to}. It expires in 10 minutes.`)
    if (action === 'confirm') {
      setOtp('')
      setMessage(d?.status === 'sent' ? 'All transfers were accepted by Paystack.' : 'Some transfers need attention. See below.')
    }
    if (action === 'refresh') setMessage('Status updated.')
    onChanged()
  }

  const shareRows: { label: string; amount: number }[] = payout
    ? [
        { label: 'Admin (25%)', amount: payout.admin_kobo },
        { label: 'Developer (25%)', amount: payout.developer_kobo },
        { label: 'Teacher (20%)', amount: payout.teacher_kobo },
        { label: 'Skillbloom (30%)', amount: payout.skillbloom_kobo },
      ]
    : []

  return (
    <div className="card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">{s.section || 'Session'}</p>
          <p className="mt-2 text-lg font-medium text-brand-text">{s.title}</p>
          <p className="mt-1 text-sm text-brand-muted">
            Ended {formatSessionTime(s.ends_at).day}
            {s.teacher && <> · {s.teacher}</>}
          </p>
          <p className="mt-1 text-sm text-brand-muted">
            {s.paid_count} paid {s.paid_count === 1 ? 'student' : 'students'} · collected {formatNaira(s.gross_kobo)}
          </p>
        </div>
        <span className={`pill shrink-0 ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>
      </div>

      {s.missing.length > 0 && (
        <p className="mt-4 rounded-xl bg-brand-accent-soft p-3 text-sm text-brand-text">
          Bank details are missing for {s.missing.map((r) => ROLE_LABEL[r]).join(', ')}. Add them on the{' '}
          <a href="/admin/payouts" className="text-brand-primary underline">Payout details</a> page first.
        </p>
      )}

      {payout && (
        <div className="mt-6 divide-y divide-brand-border border-y border-brand-border">
          <div className="flex justify-between py-3 text-sm">
            <span className="text-brand-muted">Net pool, after Paystack fees</span>
            <span className="font-medium text-brand-text">{formatNaira(payout.pool_kobo)}</span>
          </div>
          {shareRows.map((r) => (
            <div key={r.label} className="flex justify-between py-3 text-sm">
              <span className="text-brand-muted">{r.label}</span>
              <span className="text-brand-text">{formatNaira(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {payout && Object.keys(payout.transfers ?? {}).length > 0 && (
        <div className="mt-6 grid gap-3">
          {(Object.keys(payout.transfers) as Role[]).map((role) => {
            const t = payout.transfers[role]
            if (!t) return null
            return (
              <div key={role} className="rounded-xl border border-brand-border p-4 text-sm">
                <p className="font-medium text-brand-text">
                  {ROLE_LABEL[role]} · {formatNaira(t.amount_kobo)} · <span className="capitalize">{t.status.replace('_', ' ')}</span>
                </p>
                <p className="mt-1 text-brand-muted">
                  {t.account_name} · {t.bank_name} · ending {t.account_last4}
                </p>
                {t.message && t.status !== 'success' && <p className="mt-1 text-brand-error">{t.message}</p>}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canPrepare && (
          <button onClick={() => run('prepare')} disabled={!!busy} className="btn-ghost">
            {busy === 'prepare' ? 'Working' : payout ? 'Recalculate' : 'Prepare split'}
          </button>
        )}

        {canSendCode && (
          <button onClick={() => run('request_otp')} disabled={!!busy} className="btn-primary">
            {busy === 'request_otp'
              ? 'Sending code'
              : payout?.status === 'partial'
                ? 'Send code to retry unpaid shares'
                : 'Send code to admin email'}
          </button>
        )}

        {hasPending && (
          <button onClick={() => run('refresh')} disabled={!!busy} className="btn-ghost">
            {busy === 'refresh' ? 'Checking' : 'Refresh status'}
          </button>
        )}
      </div>

      {payout?.status === 'otp_sent' && (
        <div className="mt-6 grid max-w-sm gap-3">
          <label className="label" htmlFor={`otp-${s.id}`}>Enter the 6-digit code</label>
          <input
            id={`otp-${s.id}`}
            className="field font-mono tracking-[0.3em]"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          />
          <button
            onClick={() => run('confirm', { otp })}
            disabled={!!busy || otp.length !== 6}
            className="btn-primary"
          >
            {busy === 'confirm' ? 'Sending money' : 'Confirm and send money'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-brand-error">{error}</p>}
      {message && <p className="mt-4 text-sm text-brand-success">{message}</p>}
    </div>
  )
}

export default function AdminSessionPayouts() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    supabase.functions.invoke('session-payouts', { body: { action: 'overview' } }).then(({ data, error }) => {
      if (ignore) return
      if (error) setError('Payouts could not be loaded. Refresh the page to try again.')
      else setData(data as Overview)
    })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  return (
    <section className="container-page py-14 sm:py-20">
      <PageHeader
        eyebrow="Admin"
        title="Session payouts"
        description="After a session ends, prepare its split, then confirm with the code sent to your admin email. Each share goes to its saved bank account."
      />

      {data && (
        <p className="mt-6 text-sm text-brand-muted">
          Working in <span className="font-medium capitalize text-brand-text">{data.mode}</span> mode.
          {data.mode === 'test' && ' Only test payments are included.'}
        </p>
      )}

      {error && <p className="mt-10 text-sm text-brand-error">{error}</p>}
      {!data && !error && <p className="mt-10 text-brand-muted">Loading</p>}

      {data && data.sessions.length === 0 && (
        <p className="mt-10 text-brand-muted">No ended sessions with payments yet.</p>
      )}

      {data && data.sessions.length > 0 && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {data.sessions.map((s) => (
            <SessionPayoutCard key={s.id} s={s} onChanged={() => setReloadKey((k) => k + 1)} />
          ))}
        </div>
      )}
    </section>
  )
}