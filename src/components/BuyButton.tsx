import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { formatNaira } from '../lib/sessions'

type CodeCheck = {
  valid: boolean
  kind?: 'percent' | 'fixed'
  amount?: number
  reason?: string
}

type Applied = { code: string; finalKobo: number; label: string }

function priceAfter(priceKobo: number, check: CodeCheck) {
  if (check.kind === 'percent') return Math.round((priceKobo * (100 - (check.amount ?? 0))) / 100)
  return Math.max(0, priceKobo - (check.amount ?? 0))
}

function labelFor(check: CodeCheck) {
  return check.kind === 'percent' ? `${check.amount}% off` : `${formatNaira(check.amount ?? 0)} off`
}

export default function BuyButton({ sessionId, priceKobo }: { sessionId: string; priceKobo: number }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<Applied | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Checks the code against the database so the student sees the new price before paying
  async function applyCode() {
    const clean = code.trim().toUpperCase()
    if (!clean) return

    setChecking(true)
    setError(null)
    const { data, error } = await supabase.rpc('validate_discount', {
      p_code: clean,
      p_session: sessionId,
    })
    setChecking(false)

    if (error) {
      setError(error.message)
      return
    }

    const check = data as CodeCheck
    if (!check.valid) {
      setApplied(null)
      setError(check.reason ?? 'That code is not valid.')
      return
    }

    setApplied({ code: clean, finalKobo: priceAfter(priceKobo, check), label: labelFor(check) })
  }

  function removeCode() {
    setCode('')
    setApplied(null)
    setError(null)
  }

  async function handleBuy() {
    setError(null)

    if (!user) {
      navigate('/login')
      return
    }

    setBusy(true)
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        session_id: sessionId,
        discount_code: applied?.code ?? null,
        callback_url: `${window.location.origin}/payment/callback`,
      },
    })
    setBusy(false)

    if (error) {
      const body = await (error as { context?: Response }).context?.json().catch(() => null)
      setError(body?.error ?? 'Something went wrong. Please try again.')
      return
    }

    window.location.href = data.authorization_url
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-brand-text">Discount code</p>

        {applied ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand-success/30 bg-brand-success/5 px-4 py-3 text-sm">
            <span className="text-brand-text">
              <span className="font-mono font-semibold tracking-widest">{applied.code}</span>
              <span className="text-brand-muted"> · {applied.label}</span>
            </span>
            <button type="button" onClick={removeCode} className="text-brand-muted transition hover:text-brand-error">
              Remove
            </button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              className="field font-mono uppercase tracking-widest"
              placeholder="Enter code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyCode()
                }
              }}
            />
            <button
              type="button"
              onClick={applyCode}
              disabled={checking || !code.trim()}
              className="btn-ghost shrink-0 px-5"
            >
              {checking ? 'Checking' : 'Apply'}
            </button>
          </div>
        )}
      </div>

      {applied && (
        <div className="flex items-end justify-between border-t border-brand-border pt-5">
          <span className="text-sm text-brand-muted">You pay</span>
          <div className="text-right">
            <p className="text-sm text-brand-muted line-through">{formatNaira(priceKobo)}</p>
            <p className="font-serif text-2xl text-brand-text">{formatNaira(applied.finalKobo)}</p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-brand-error">{error}</p>}

      <button onClick={handleBuy} disabled={busy} className="btn-primary w-full py-3.5">
        {busy ? 'Starting payment' : user ? 'Buy access' : 'Sign in to buy'}
      </button>

      <p className="text-center text-xs leading-relaxed text-brand-muted">
        Secure payment by Paystack. You can request a refund any time before the session starts.
      </p>
    </div>
  )
}