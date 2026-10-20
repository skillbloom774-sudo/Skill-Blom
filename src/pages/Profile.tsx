import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import PageHeader from '../components/PageHeader'

const CONFIRM_WORD = 'DELETE'

export default function Profile() {
  const { user, role, loading } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let ignore = false

    Promise.all([
      supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
      supabase
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', user.id)
        .eq('status', 'paid')
        .gt('access_ends_at', new Date().toISOString()),
    ]).then(([profileRes, countRes]) => {
      if (ignore) return
      setFullName(profileRes.data?.full_name ?? '')
      setPhone(profileRes.data?.phone ?? '')
      setActiveCount(countRes.count ?? 0)
    })

    return () => {
      ignore = true
    }
  }, [user])

  if (loading) return <p className="container-page py-16 text-brand-muted">Loading</p>
  if (!user) return <Navigate to="/login" replace />

  const isStudent = role === 'student'

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaved(null)
    setSaveError(null)
    setSaving(true)

    const cleanName = fullName.trim()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: cleanName || null, phone: phone.trim() || null })
      .eq('id', user!.id)

    if (!error) {
      // Keeps the name in the header and greeting in step with the profile
      await supabase.auth.updateUser({ data: { full_name: cleanName } })
    }

    setSaving(false)
    if (error) setSaveError(error.message)
    else setSaved('Your details are saved.')
  }

  async function deleteAccount() {
    setDeleteError(null)

    if (confirmText !== CONFIRM_WORD) {
      setDeleteError(`Type ${CONFIRM_WORD} in capitals to confirm.`)
      return
    }
    if (!confirm('This permanently deletes your account. Continue?')) return

    setDeleting(true)
    const { error } = await supabase.functions.invoke('delete-account', { body: {} })

    if (error) {
      const body = await (error as { context?: Response }).context?.json().catch(() => null)
      setDeleting(false)
      setDeleteError(body?.error ?? 'Your account could not be deleted. Please try again.')
      return
    }

    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <section className="container-page py-12 sm:py-16">
      <PageHeader
        eyebrow="Account"
        title="Your details"
        description="Update how your name and number appear on Skillbloom, or close your account."
      />

      <form onSubmit={save} className="card mt-10 grid max-w-2xl gap-6">
        <div>
          <p className="label">Email</p>
          <p className="text-brand-muted">{user.email}</p>
          <p className="mt-1.5 text-xs text-brand-muted">Your email is used to sign in and cannot be changed here.</p>
        </div>

        <div>
          <label className="label" htmlFor="pf-name">Full name</label>
          <input id="pf-name" className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <div>
          <label className="label" htmlFor="pf-phone">Phone number</label>
          <input id="pf-phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        {saveError && <p className="text-sm text-brand-error">{saveError}</p>}
        {saved && <p className="text-sm text-brand-success">{saved}</p>}

        <div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving' : 'Save details'}
          </button>
        </div>
      </form>

      <div className="mt-14 max-w-2xl rounded-2xl border border-brand-error/30 bg-brand-surface p-6 sm:p-8">
        <p className="eyebrow text-brand-error">Close account</p>

        {!isStudent ? (
          <p className="mt-4 leading-relaxed text-brand-muted">
            Admin and teacher accounts are closed by the Skillbloom team. Please contact us to do this.
          </p>
        ) : (
          <>
            <h2 className="mt-3 text-2xl">Delete my account</h2>

            {activeCount !== null && activeCount > 0 && (
              <div className="mt-5 rounded-xl bg-brand-error/10 p-4 text-sm leading-relaxed text-brand-error">
                You have {activeCount} active {activeCount === 1 ? 'session' : 'sessions'}. Deleting your account
                ends your access straight away, and it does not refund payments. If you are owed a refund, request
                it first from your dashboard.
              </div>
            )}

            <div className="mt-6 grid gap-5 text-sm leading-relaxed text-brand-muted">
              <p>
                <span className="font-medium text-brand-text">Deleted:</span> your login and profile, your chat
                messages and private chats with teachers, your submitted work, and any files you uploaded.
              </p>
              <p>
                <span className="font-medium text-brand-text">Kept:</span> payment records, for the period Nigerian
                financial rules require. Your name and contact details are removed from them.
              </p>
              <p>This cannot be undone.</p>
            </div>

            <div className="mt-8 grid max-w-sm gap-3">
              <label className="label" htmlFor="pf-confirm">Type {CONFIRM_WORD} to confirm</label>
              <input
                id="pf-confirm"
                className="field"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
              {deleteError && <p className="text-sm text-brand-error">{deleteError}</p>}
              <button
                onClick={deleteAccount}
                disabled={deleting || confirmText !== CONFIRM_WORD}
                className="rounded-xl bg-brand-error px-5 py-3 text-[15px] font-medium text-white transition hover:bg-brand-error/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? 'Deleting' : 'Delete my account'}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}