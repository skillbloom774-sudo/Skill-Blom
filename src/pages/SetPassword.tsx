import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

export default function SetPassword() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (error) setError(error.message)
    else navigate('/teacher')
  }

  if (loading) return <p className="container-page py-16 text-brand-muted">Loading</p>

  if (!user) {
    return (
      <section className="container-page max-w-md py-16 sm:py-20">
        <h1 className="text-3xl">This link has expired</h1>
        <p className="mt-4 text-brand-muted">Ask the Skillbloom admin to send you a new invite.</p>
      </section>
    )
  }

  return (
    <section className="container-page max-w-md py-16 sm:py-20">
      <p className="eyebrow">Welcome</p>
      <h1 className="mt-3 text-3xl">Set your password</h1>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        <div>
          <label className="label" htmlFor="pw">New password</label>
          <input id="pw" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pw2">Confirm password</label>
          <input id="pw2" type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-brand-error">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Saving' : 'Save password'}
        </button>
      </form>
    </section>
  )
}