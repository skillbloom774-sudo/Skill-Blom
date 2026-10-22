import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Recording = { id: string; title: string; url: string }

export default function StudentRecordings({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<Recording[] | null>(null)

  useEffect(() => {
    let ignore = false

    supabase
      .from('recordings')
      .select('id, title, url')
      .eq('session_id', sessionId)
      .eq('published', true)
      .order('created_at')
      .then(({ data }) => {
        if (!ignore) setRows((data as Recording[]) ?? [])
      })

    return () => {
      ignore = true
    }
  }, [sessionId])

  if (rows === null || rows.length === 0) return null

  return (
    <div className="mt-16">
      <h2 className="text-2xl">Recordings</h2>
      <div className="mt-6 grid gap-4">
        {rows.map((r) => (
          <a
            key={r.id}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card flex items-center justify-between gap-4 transition hover:border-brand-primary"
          >
            <span className="font-medium text-brand-text">{r.title}</span>
            <span className="shrink-0 text-sm text-brand-primary">Watch →</span>
          </a>
        ))}
      </div>
    </div>
  )
}