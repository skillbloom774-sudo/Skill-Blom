import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import ChatPanel from './ChatPanel'

export default function ChatSection({ sessionId }: { sessionId: string }) {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const isManager = isAdmin || role === 'guest_teacher'

  const [tab, setTab] = useState<'group' | 'private'>('group')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [privateId, setPrivateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    supabase.rpc('session_group_thread', { p_session_id: sessionId }).then(({ data, error }) => {
      if (ignore) return
      if (error) setError(error.message)
      else setGroupId(data as string)
    })

    return () => {
      ignore = true
    }
  }, [sessionId])

  useEffect(() => {
    if (tab !== 'private' || isManager || privateId) return
    let ignore = false

    supabase.rpc('open_private_thread', { p_session_id: sessionId }).then(({ data, error }) => {
      if (ignore) return
      if (error) setError(error.message)
      else setPrivateId(data as string)
    })

    return () => {
      ignore = true
    }
  }, [tab, isManager, privateId, sessionId])

  if (error) return <p className="mt-12 text-sm text-brand-error">{error}</p>
  if (!groupId) return <p className="mt-12 text-sm text-brand-muted">Loading chat</p>

  const showPrivate = !isManager
  const activeId = tab === 'private' && privateId ? privateId : groupId

  return (
    <div className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Chat</p>
          <h2 className="mt-2 text-2xl">Talk with your class</h2>
        </div>
        {showPrivate && (
          <div className="flex gap-2">
            <button
              onClick={() => setTab('group')}
              className={`rounded-full px-4 py-2 text-sm transition ${
                tab === 'group'
                  ? 'bg-brand-primary text-white'
                  : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
              }`}
            >
              Class chat
            </button>
            <button
              onClick={() => setTab('private')}
              className={`rounded-full px-4 py-2 text-sm transition ${
                tab === 'private'
                  ? 'bg-brand-primary text-white'
                  : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
              }`}
            >
              Message my teacher
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <ChatPanel
          key={activeId}
          threadId={activeId}
          title={tab === 'private' ? 'Private to you and your teacher' : 'Class chat'}
          subtitle={
            tab === 'private'
              ? 'Only you and your teacher can see these messages.'
              : 'Everyone enrolled in this session can read this chat.'
          }
          isManager={isManager}
          isAdmin={isAdmin}
          canAskAnonymously={!isManager && tab === 'group'}
          emptyText={
            tab === 'private'
              ? 'Ask anything here if you would rather not speak up in class.'
              : 'No messages yet. Introduce yourself.'
          }
        />
      </div>
    </div>
  )
}