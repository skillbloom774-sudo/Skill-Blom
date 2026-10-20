import { useState } from 'react'
import { formatBytes, openStoredFile } from '../lib/files'

export type Attachment = { path: string; name: string; size?: number | null }

export default function Attachments({
  bucket,
  items,
}: {
  bucket: 'materials' | 'submissions'
  items: Attachment[]
}) {
  const [error, setError] = useState<string | null>(null)

  if (items.length === 0) return null

  async function open(path: string) {
    setError(null)
    try {
      await openStoredFile(bucket, path)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="grid gap-2">
      {items.map((f) => (
        <button
          key={f.path}
          onClick={() => open(f.path)}
          className="flex items-center justify-between gap-4 rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-left text-sm transition hover:border-brand-primary"
        >
          <span className="truncate text-brand-text">{f.name}</span>
          {f.size != null && <span className="shrink-0 text-xs text-brand-muted">{formatBytes(f.size)}</span>}
        </button>
      ))}
      {error && <p className="text-sm text-brand-error">{error}</p>}
    </div>
  )
}