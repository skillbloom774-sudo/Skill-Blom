import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { setMessageFlags } from '../../lib/chat'
import ChatPanel from '../../components/ChatPanel'
import { formatSessionTime } from '../../lib/sessions'

type QueueItem = {
  id: string
  thread_id: string
  body: string
  created_at: string
  is_anonymous: boolean
  thread_kind: 'group' | 'private'
  sender_name: string
}

type InboxItem = {
  thread_id: string
  student_name: string
  last_at: string | null
  open_questions: number
}

type Active = { id: string; label: string }

function when(iso: string) {
  const f = formatSessionTime(iso)
  return `${f.day}, ${f.time}`
}

export default function TeacherChat() {
  const { id } = useParams()
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [active, setActive] = useState<Active | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let ignore = false

    Promise.all([
      supabase.from('sessions').select('title').eq('id', id).maybeSingle(),
      supabase.rpc('session_group_thread', { p_session_id: id }),
      supabase.rpc('question_queue', { p_session_id: id }),
      supabase.rpc('teacher_inbox', { p_session_id: id }),
    ]).then(([s, g, q, i]) => {
      if (ignore) return
      const failed = g.error || q.error || i.error
      if (failed) {
        setError(failed.message)
        setLoaded(true)
        return
      }
      setTitle(s.data?.title ?? null)
      setGroupId(g.data as string)
      setQueue((q.data as QueueItem[]) ?? [])
      setInbox((i.data as InboxItem[]) ?? [])
      setLoaded(true)
    })

    return () => {
      ignore = true
    }
  }, [id, reloadKey])

  if (!loaded) return <p className="container-page py-16 text-brand-muted">Loading chat</p>

  if (!title || !groupId) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">Session not found</h1>
        <Link to="/teacher" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to your sessions
        </Link>
      </section>
    )
  }

  const current: Active = active ?? { id: groupId, label: 'Class chat' }

  async function markAnswered(item: QueueItem) {
    setError(null)
    try {
      await setMessageFlags(item.id, { answered: true })
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="container-page py-12 sm:py-16">
      <Link to="/teacher" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← Your sessions
      </Link>

      <p className="eyebrow mt-8">Chat</p>
      <h1 className="mt-3 text-4xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-brand-muted">
        Students see "Anonymous" for anonymous questions, but you can always see who sent them. Mark questions
        answered once you've replied.
      </p>

      {error && <p className="mt-6 text-sm text-brand-error">{error}</p>}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setActive(null)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                current.id === groupId
                  ? 'bg-brand-primary text-white'
                  : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
              }`}
            >
              Class chat
            </button>
            {current.id !== groupId && (
              <span className="rounded-full bg-brand-primary-soft px-4 py-2 text-sm text-brand-primary">
                {current.label}
              </span>
            )}
          </div>

          <ChatPanel
            key={current.id}
            threadId={current.id}
            title={current.label}
            subtitle={current.id === groupId ? 'Everyone enrolled in this session.' : 'Private conversation with this student.'}
            isManager
            isAdmin={isAdmin}
            canAskAnonymously={false}
            emptyText="No messages yet."
          />
        </div>

        <aside className="grid content-start gap-8">
          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Open questions</p>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="text-xs text-brand-primary hover:underline"
              >
                Refresh
              </button>
            </div>
            {queue.length === 0 && <p className="mt-4 text-sm text-brand-muted">No open questions.</p>}
            <div className="mt-4 grid gap-4">
              {queue.map((item) => (
                <div key={item.id} className="rounded-xl bg-brand-background p-4">
                  <p className="text-xs text-brand-muted">
                    {item.thread_kind === 'group' ? 'Class chat' : 'Private'} · {item.sender_name}
                    {item.is_anonymous && ' (sent anonymously)'}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-brand-text">{item.body}</p>
                  <p className="mt-2 text-xs text-brand-muted">{when(item.created_at)}</p>
                  <div className="mt-3 flex gap-4 text-sm">
                    <button
                      onClick={() =>
                        setActive({
                          id: item.thread_id,
                          label: item.thread_kind === 'group' ? 'Class chat' : item.sender_name,
                        })
                      }
                      className="text-brand-primary hover:underline"
                    >
                      Open chat
                    </button>
                    <button onClick={() => markAnswered(item)} className="text-brand-success hover:underline">
                      Mark answered
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">Private chats</p>
            {inbox.length === 0 && (
              <p className="mt-4 text-sm text-brand-muted">No students have messaged you privately yet.</p>
            )}
            <div className="mt-4 grid gap-3">
              {inbox.map((row) => (
                <button
                  key={row.thread_id}
                  onClick={() => setActive({ id: row.thread_id, label: row.student_name })}
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand-border px-4 py-3 text-left text-sm transition hover:border-brand-primary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-brand-text">{row.student_name}</span>
                    {row.last_at && <span className="text-xs text-brand-muted">{when(row.last_at)}</span>}
                  </span>
                  {row.open_questions > 0 && (
                    <span className="pill bg-brand-accent-soft text-brand-accent">{row.open_questions}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}