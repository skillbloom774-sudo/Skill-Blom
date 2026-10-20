import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const DISMISS_KEY = 'skillbloom-onboarding-dismissed'

type Props = {
  user: User
  hasPurchase: boolean
  firstSessionId: string | null
}

export default function OnboardingChecklist({ user, hasPurchase, firstSessionId }: Props) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === user.id)
  const [messageCount, setMessageCount] = useState<number | null>(null)

  // Counts the messages this account has sent. Anonymous messages don't count, since they hide the sender.
  useEffect(() => {
    let ignore = false

    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .then(({ count, error }) => {
        if (ignore) return
        if (!error) setMessageCount(count ?? 0)
      })

    return () => {
      ignore = true
    }
  }, [user.id])

  const steps = [
    {
      id: 'email',
      label: 'Confirm your email',
      done: Boolean(user.email_confirmed_at),
      href: null as string | null,
    },
    {
      id: 'session',
      label: 'Get your first session',
      done: hasPurchase,
      href: '/sessions',
    },
    {
      id: 'hello',
      label: 'Say hello in your class chat',
      done: (messageCount ?? 0) > 0,
      href: firstSessionId ? `/sessions/${firstSessionId}/room` : null,
    },
  ]

  const completed = steps.filter((s) => s.done).length
  const allDone = completed === steps.length

  if (dismissed || allDone) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, user.id)
    setDismissed(true)
  }

  return (
    <div className="card mt-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Getting started</p>
          <h2 className="mt-2 text-xl">
            {completed} of {steps.length} done
          </h2>
        </div>
        <button onClick={dismiss} className="text-sm text-brand-muted transition hover:text-brand-text">
          Hide
        </button>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-border">
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>

      <ul className="mt-6 grid gap-4">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  s.done ? 'bg-brand-success text-white' : 'border border-brand-border text-brand-muted'
                }`}
              >
                {s.done ? '✓' : ''}
              </span>
              <span className={s.done ? 'text-brand-muted line-through' : 'text-brand-text'}>{s.label}</span>
            </div>
            {!s.done && s.href && (
              <Link to={s.href} className="text-sm text-brand-primary hover:underline">
                Go
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}