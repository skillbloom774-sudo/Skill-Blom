import SessionCard from './SessionCard'
import type { SessionListItem } from '../lib/sessions'

type Props = {
  sessions: SessionListItem[] | null
  error: string | null
  limit?: number
}

export default function SessionList({ sessions, error, limit }: Props) {
  if (error) {
    return <p className="mt-8 text-sm text-brand-error">Sessions could not be loaded. Please refresh the page.</p>
  }

  if (sessions === null) {
    return <p className="mt-8 text-sm text-brand-muted">Loading sessions</p>
  }

  if (sessions.length === 0) {
    return (
      <p className="mt-8 text-brand-muted">
        No sessions are scheduled yet. New sessions appear here once they are published.
      </p>
    )
  }

  const visible = limit ? sessions.slice(0, limit) : sessions

  return (
    <div className="mt-8">
      {visible.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  )
}