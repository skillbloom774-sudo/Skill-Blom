import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Recording = {
  id: string
  title: string
  url: string
  published: boolean
}

export default function RecordingsManager({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<Recording[] | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false

    supabase
      .from('recordings')
      .select('id, title, url, published')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (ignore) return
        if (error) setError(error.message)
        else setRows((data as Recording[]) ?? [])
      })

    return () => {
      ignore = true
    }
  }, [sessionId, reloadKey])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanUrl = url.trim()
    if (!cleanUrl.startsWith('https://')) {
      setError('The link must start with https://')
      return
    }

    setBusy(true)
    const { error } = await supabase.from('recordings').insert({
      session_id: sessionId,
      title: title.trim(),
      url: cleanUrl,
      published: false,
    })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    setTitle('')
    setUrl('')
    setReloadKey((k) => k + 1)
  }

  async function togglePublished(r: Recording) {
    setError(null)
    const { error } = await supabase
      .from('recordings')
      .update({ published: !r.published })
      .eq('id', r.id)
    if (error) setError(error.message)
    else setReloadKey((k) => k + 1)
  }

  async function remove(r: Recording) {
    if (!confirm(`Delete the recording "${r.title}"?`)) return
    setError(null)
    const { error } = await supabase.from('recordings').delete().eq('id', r.id)
    if (error) setError(error.message)
    else setReloadKey((k) => k + 1)
  }

  return (
    <div className="card mt-10 sm:max-w-3xl">
      <p className="eyebrow">Recordings</p>
      <h2 className="mt-2 text-xl">Add a recording</h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">
        Paste a link from YouTube (unlisted), Google Drive, or Vimeo. Students only see recordings you publish.
      </p>

      <form onSubmit={add} className="mt-6 grid gap-4">
        <div>
          <label className="label" htmlFor="rec-title">Title</label>
          <input
            id="rec-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Week 1 recording"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="rec-url">Link</label>
          <input
            id="rec-url"
            type="url"
            className="field"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            required
          />
        </div>
        {error && <p className="text-sm text-brand-error">{error}</p>}
        <div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Adding' : 'Add recording'}
          </button>
        </div>
      </form>

      <div className="mt-8 divide-y divide-brand-border border-t border-brand-border">
        {rows === null && <p className="py-5 text-sm text-brand-muted">Loading recordings</p>}
        {rows !== null && rows.length === 0 && (
          <p className="py-5 text-sm text-brand-muted">No recordings added yet.</p>
        )}
        {rows?.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-brand-text">{r.title}</p>
              <p className="mt-1 truncate text-xs text-brand-muted">{r.url}</p>
              <span
                className={`pill mt-2 ${
                  r.published ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-border/60 text-brand-muted'
                }`}
              >
                {r.published ? 'Published' : 'Hidden from students'}
              </span>
            </div>
            <div className="flex shrink-0 gap-5 text-sm">
              <button onClick={() => togglePublished(r)} className="text-brand-primary hover:underline">
                {r.published ? 'Hide' : 'Publish'}
              </button>
              <button onClick={() => remove(r)} className="text-brand-error hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}