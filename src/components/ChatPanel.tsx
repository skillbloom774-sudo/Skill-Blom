import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchThread,
  sendMessage,
  toggleReaction,
  reportMessage,
  setMessageFlags,
  REACTIONS,
  type ChatMessage,
} from '../lib/chat'

type Props = {
  threadId: string
  title: string
  subtitle?: string
  isManager: boolean
  isAdmin: boolean
  canAskAnonymously: boolean
  emptyText?: string
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  })
}

export default function ChatPanel({
  threadId,
  title,
  subtitle,
  isManager,
  isAdmin,
  canAskAnonymously,
  emptyText = 'No messages yet. Say hello.',
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [asQuestion, setAsQuestion] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load the thread and keep it live
  useEffect(() => {
    let cancelled = false

    function reload() {
      fetchThread(threadId)
        .then((rows) => {
          if (cancelled) return
          setMessages(rows)
          setLoaded(true)
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message)
        })
    }

    reload()

    const channel = supabase
      .channel(`chat-${threadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        reload,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, reload)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  async function refresh() {
    try {
      setMessages(await fetchThread(threadId))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      await sendMessage(threadId, body, {
        anonymous: anonymous && canAskAnonymously,
        question: asQuestion,
      })
      setBody('')
      setAsQuestion(false)
      setAnonymous(false)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function react(messageId: string, emoji: string) {
    setError(null)
    try {
      await toggleReaction(messageId, emoji)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function report(messageId: string) {
    const reason = window.prompt('What is wrong with this message? (optional)')
    if (reason === null) return
    setError(null)
    try {
      await reportMessage(messageId, reason)
      setNotice('Thanks. A moderator will review it.')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function flag(messageId: string, flags: { answered?: boolean; pinned?: boolean }) {
    setError(null)
    try {
      await setMessageFlags(messageId, flags)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function remove(messageId: string) {
    if (!confirm('Delete this message for everyone?')) return
    const { error } = await supabase.from('chat_messages').delete().eq('id', messageId)
    if (error) setError(error.message)
    else await refresh()
  }

  const pinned = messages.find((m) => m.pinned)

  return (
    <div className="card flex flex-col overflow-hidden p-0">
      <div className="border-b border-brand-border px-5 py-4">
        <p className="font-medium text-brand-text">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-brand-muted">{subtitle}</p>}
      </div>

      {pinned && (
        <div className="border-b border-brand-border bg-brand-accent-soft px-5 py-3 text-sm text-brand-text">
          <span className="font-medium">Pinned:</span> {pinned.body}
        </div>
      )}

      <div className="min-h-[16rem] max-h-[30rem] space-y-4 overflow-y-auto p-5">
        {!loaded && <p className="text-sm text-brand-muted">Loading messages</p>}
        {loaded && messages.length === 0 && <p className="text-sm text-brand-muted">{emptyText}</p>}

        {messages.map((m) => {
          const counts = new Map(m.reactions.map((r) => [r.emoji, r]))
          return (
            <div
              key={m.id}
              className={`rounded-2xl p-4 ${m.sender_is_teacher ? 'bg-brand-primary-soft' : 'bg-brand-background'}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-brand-text">
                  {m.sender_name}
                  {m.mine && ' (you)'}
                </span>
                {m.sender_is_teacher && <span className="pill">Teacher</span>}
                <span className="text-brand-muted">{timeOf(m.created_at)}</span>
                {m.is_question && (
                  <span
                    className={`pill ${
                      m.answered ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-accent-soft text-brand-accent'
                    }`}
                  >
                    {m.answered ? 'Answered' : 'Question'}
                  </span>
                )}
                {m.pinned && <span className="pill">Pinned</span>}
              </div>

              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-text">{m.body}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {REACTIONS.map((emoji) => {
                  const r = counts.get(emoji)
                  return (
                    <button
                      key={emoji}
                      onClick={() => react(m.id, emoji)}
                      className={`rounded-full border px-2.5 py-1 transition ${
                        r?.mine
                          ? 'border-brand-primary bg-brand-primary-soft'
                          : 'border-brand-border bg-brand-surface hover:border-brand-primary'
                      }`}
                    >
                      {emoji}
                      {r && r.count > 0 && <span className="ml-1 text-brand-muted">{r.count}</span>}
                    </button>
                  )
                })}

                {!m.mine && (
                  <button onClick={() => report(m.id)} className="ml-auto text-brand-muted hover:text-brand-error">
                    Report
                  </button>
                )}
                {isManager && m.is_question && (
                  <button
                    onClick={() => flag(m.id, { answered: !m.answered })}
                    className="text-brand-primary hover:underline"
                  >
                    {m.answered ? 'Mark unanswered' : 'Mark answered'}
                  </button>
                )}
                {isManager && (
                  <button
                    onClick={() => flag(m.id, { pinned: !m.pinned })}
                    className="text-brand-primary hover:underline"
                  >
                    {m.pinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => remove(m.id)} className="text-brand-error hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="border-t border-brand-border p-5">
        <textarea
          className="field min-h-20"
          maxLength={2000}
          placeholder="Write a message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-5 text-sm text-brand-muted">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={asQuestion}
                onChange={(e) => setAsQuestion(e.target.checked)}
                className="h-4 w-4 accent-brand-primary"
              />
              This is a question
            </label>
            {canAskAnonymously && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="h-4 w-4 accent-brand-primary"
                />
                Send anonymously
              </label>
            )}
          </div>
          <button type="submit" disabled={busy || !body.trim()} className="btn-primary px-5 py-2.5 text-sm">
            {busy ? 'Sending' : 'Send'}
          </button>
        </div>
        {anonymous && canAskAnonymously && (
          <p className="mt-2 text-xs text-brand-muted">
            Other students will see "Anonymous." Your teacher can still see your name.
          </p>
        )}
      </form>

      {error && <p className="px-5 pb-4 text-sm text-brand-error">{error}</p>}
      {notice && <p className="px-5 pb-4 text-sm text-brand-success">{notice}</p>}
    </div>
  )
}