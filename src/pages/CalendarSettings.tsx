import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import PageHeader from '../components/PageHeader'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export default function CalendarSettings() {
  const { user, loading } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let ignore = false

    supabase.rpc('get_calendar_token').then(({ data, error }) => {
      if (ignore) return
      if (error) setError(error.message)
      else setToken(data as string)
    })

    return () => {
      ignore = true
    }
  }, [user])

  if (loading) return <p className="container-page py-16 text-brand-muted">Loading</p>
  if (!user) return <Navigate to="/login" replace />

  const feedUrl = token ? `${SUPABASE_URL}/functions/v1/calendar-feed?token=${token}` : null

  async function copyLink() {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Your browser blocked copying. Select the link and copy it yourself.')
    }
  }

  async function resetLink() {
    if (!confirm('Create a new link? The current link will stop working, so update it in your calendar app.')) return

    setBusy(true)
    setError(null)
    setNotice(null)
    const { data, error } = await supabase.rpc('reset_calendar_token')
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    setToken(data as string)
    setNotice('New link created. Replace the old one in your calendar app.')
  }

  return (
    <section className="container-page py-12 sm:py-16">
      <PageHeader
        eyebrow="Calendar"
        title="Your calendar feed"
        description="Subscribe once, and your sessions appear in your calendar automatically, including new ones you buy. Finished sessions drop off by themselves."
      />

      <div className="card mt-10 max-w-3xl">
        <p className="eyebrow">Your private link</p>

        {!feedUrl && !error && <p className="mt-4 text-brand-muted">Creating your link</p>}

        {feedUrl && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              readOnly
              value={feedUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Your calendar link"
              className="field min-w-0 flex-1 font-mono text-xs"
            />
            <button onClick={copyLink} className="btn-primary shrink-0 px-4 py-2 text-sm">
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        )}

        <p className="mt-4 rounded-xl bg-brand-accent-soft p-4 text-sm leading-relaxed text-brand-text">
          Keep this link private. Anyone who has it can see your session titles and times. If it is shared by
          mistake, create a new one below.
        </p>

        {error && <p className="mt-4 text-sm text-brand-error">{error}</p>}
        {notice && <p className="mt-4 text-sm text-brand-success">{notice}</p>}

        <div className="mt-6">
          <button onClick={resetLink} disabled={busy || !token} className="btn-ghost text-sm">
            {busy ? 'Creating' : 'Create a new link'}
          </button>
        </div>
      </div>

      <div className="card mt-8 max-w-3xl">
        <p className="eyebrow">How to add it</p>
        <div className="mt-5 grid gap-5 text-sm leading-relaxed text-brand-muted">
          <p>
            <span className="font-medium text-brand-text">Google Calendar (computer):</span> Settings, then Add
            calendar, then From URL. Paste the link and choose Add calendar.
          </p>
          <p>
            <span className="font-medium text-brand-text">Google Calendar (Android):</span> open the menu on the
            calendar screen, choose Settings, then Add calendar, then From URL.
          </p>
          <p>
            <span className="font-medium text-brand-text">iPhone:</span> Settings, then Calendar, then Accounts, then
            Add Account, then Other, then Add Subscribed Calendar. Paste the link.
          </p>
          <p>
            <span className="font-medium text-brand-text">Outlook:</span> Add calendar, then Subscribe from web. Paste
            the link and give it a name.
          </p>
          <p className="text-xs">
            Calendar apps check subscribed feeds every few hours, so a new session can take a while to appear.
          </p>
        </div>
      </div>
    </section>
  )
}