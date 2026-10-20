import { useState } from 'react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

export default function ShareButton({ sessionId, title }: { sessionId: string; title: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const shareLink = SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/session-preview?id=${sessionId}`
    : null

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Link copied. You can paste it into WhatsApp now.')
    } catch {
      setMessage('Your browser blocked copying. Select the link below and copy it yourself.')
    }
  }

  async function handleShare() {
    setMessage(null)

    if (!shareLink) {
      setMessage('The share link is not set up yet. Check VITE_SUPABASE_URL in .env.local.')
      return
    }

    setLink(shareLink)
    setBusy(true)

    // Phones open the native share menu. Computers copy the link instead.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: shareLink })
        setMessage('Shared.')
        setBusy(false)
        return
      } catch (err) {
        // Closing the share menu is not an error, so just fall through to copying
        if ((err as Error).name === 'AbortError') {
          setBusy(false)
          return
        }
      }
    }

    await copyLink(shareLink)
    setBusy(false)
  }

  return (
    <div className="grid gap-3">
      <button onClick={handleShare} disabled={busy} className="btn-ghost w-fit px-4 py-2 text-sm">
        {busy ? 'Preparing link' : 'Share session'}
      </button>

      {message && <p className="text-sm text-brand-muted">{message}</p>}

      {link && (
        <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Session share link"
            className="field min-w-0 flex-1 font-mono text-xs"
          />
          <button onClick={() => copyLink(link)} className="btn-ghost shrink-0 px-4 py-2 text-sm">
            Copy link
          </button>
        </div>
      )}
    </div>
  )
}