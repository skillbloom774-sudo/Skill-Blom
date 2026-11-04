import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Bank = { name: string; code: string }

export type SavedPayout = {
  account_name: string
  bank_name: string
  account_last4: string
  updated_at: string
}

type Props = {
  shareRole: 'admin' | 'developer' | 'teacher'
  guestTeacherId?: string
  title: string
  saved: SavedPayout | null
  onSaved: () => void
}

export default function PayoutForm({ shareRole, guestTeacherId, title, saved, onSaved }: Props) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [editing, setEditing] = useState(!saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const fieldId = `payout-${shareRole}-${guestTeacherId ?? 'single'}`

  useEffect(() => {
    let ignore = false
    supabase.functions.invoke('payout-details', { body: { action: 'banks' } }).then(({ data, error }) => {
      if (ignore) return
      if (error) setError('The bank list could not be loaded. Refresh the page to try again.')
      else setBanks((data?.banks as Bank[]) ?? [])
    })
    return () => {
      ignore = true
    }
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    const { data, error } = await supabase.functions.invoke('payout-details', {
      body: {
        action: 'save',
        share_role: shareRole,
        guest_teacher_id: guestTeacherId,
        label: title,
        bank_code: bankCode,
        account_number: accountNumber,
      },
    })
    setBusy(false)

    if (error) {
      const body = await (error as { context?: Response }).context?.json().catch(() => null)
      setError(body?.error ?? 'Could not save. Try again.')
      return
    }

    setNotice(`Saved. Account name: ${data.account_name}`)
    setAccountNumber('')
    setEditing(false)
    onSaved()
  }

  return (
    <div className="card">
      <p className="eyebrow">Payout account</p>
      <h2 className="mt-2 text-xl">{title}</h2>

      {saved && !editing && (
        <div className="mt-4 grid gap-2 text-sm">
          <p className="text-brand-text">{saved.account_name}</p>
          <p className="text-brand-muted">
            {saved.bank_name} · ending {saved.account_last4}
          </p>
          <p className="text-xs text-brand-muted">
            Last saved{' '}
            {new Date(saved.updated_at).toLocaleDateString('en-NG', {
              timeZone: 'Africa/Lagos',
              dateStyle: 'medium',
            })}
          </p>
          <button onClick={() => setEditing(true)} className="btn-ghost mt-3 w-fit">
            Change account
          </button>
        </div>
      )}

      {(!saved || editing) && (
        <form onSubmit={save} className="mt-4 grid gap-5">
          <div>
            <label className="label" htmlFor={`${fieldId}-bank`}>Bank</label>
            <select
              id={`${fieldId}-bank`}
              className="field"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              required
            >
              <option value="">Choose a bank</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor={`${fieldId}-account`}>Account number</label>
            <input
              id={`${fieldId}-account`}
              className="field"
              inputMode="numeric"
              maxLength={10}
              placeholder="10 digits"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <p className="text-xs leading-relaxed text-brand-muted">
            The account is checked with the bank before it is saved. Skillbloom keeps only the last four digits.
          </p>

          {error && <p className="text-sm text-brand-error">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy || !bankCode || accountNumber.length !== 10}
              className="btn-primary"
            >
              {busy ? 'Checking account' : 'Save account'}
            </button>
            {saved && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setError(null)
                }}
                className="btn-ghost"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {!editing && notice && <p className="mt-4 text-sm text-brand-success">{notice}</p>}
    </div>
  )
}