import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Status = 'checking' | 'paid' | 'failed' | 'pending' | 'missing'

function StatusMark({ status }: { status: Status }) {
  const base = 'flex h-16 w-16 items-center justify-center rounded-full'
  const icon = 'h-7 w-7'
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (status === 'checking') {
    return (
      <div className={`${base} bg-brand-primary-soft`}>
        <span className="h-3 w-3 animate-pulse rounded-full bg-brand-primary" />
      </div>
    )
  }
  if (status === 'paid') {
    return (
      <div className={`${base} bg-brand-success/10 text-brand-success`}>
        <svg viewBox="0 0 24 24" className={icon} {...stroke}>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className={`${base} bg-brand-error/10 text-brand-error`}>
        <svg viewBox="0 0 24 24" className={icon} {...stroke}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </div>
    )
  }
  return (
    <div className={`${base} bg-brand-accent-soft text-brand-accent`}>
      <svg viewBox="0 0 24 24" className={icon} {...stroke}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2" />
      </svg>
    </div>
  )
}

export default function PaymentCallback() {
  const [params] = useSearchParams()
  const reference = params.get('reference') ?? params.get('trxref')
  const [status, setStatus] = useState<Status>(reference ? 'checking' : 'missing')

  useEffect(() => {
    if (!reference) return
    let ignore = false
    let attempts = 0

    async function check() {
      if (ignore) return
      const { data } = await supabase
        .from('purchases')
        .select('status')
        .eq('paystack_reference', reference)
        .maybeSingle()
      if (ignore) return

      if (data?.status === 'paid') {
        setStatus('paid')
        return
      }
      if (data?.status === 'failed') {
        setStatus('failed')
        return
      }

      attempts += 1
      if (attempts >= 10) {
        setStatus('pending')
        return
      }
      setTimeout(check, 2000)
    }

    check()
    return () => {
      ignore = true
    }
  }, [reference])

  const copy: Record<Status, { eyebrow: string; title: string; body: string }> = {
    checking: {
      eyebrow: 'Payment',
      title: 'Confirming your payment',
      body: 'This usually takes a few seconds. Please keep this page open.',
    },
    paid: {
      eyebrow: 'Payment complete',
      title: "You're in",
      body: 'Your access is active. Your session room and access card are ready on your dashboard.',
    },
    pending: {
      eyebrow: 'Still processing',
      title: 'Almost there',
      body: 'Your payment is still being confirmed. Check your dashboard in a few minutes. You will also get an email.',
    },
    failed: {
      eyebrow: 'Payment not completed',
      title: "The payment didn't go through",
      body: 'No access was granted. You can try again from the session page.',
    },
    missing: {
      eyebrow: 'Payment',
      title: 'Nothing to check',
      body: 'We could not find a payment reference for this page.',
    },
  }

  const text = copy[status]

  return (
    <section className="container-page py-16 sm:py-24">
      <div className="card mx-auto max-w-lg p-10 text-center">
        <div className="flex justify-center">
          <StatusMark status={status} />
        </div>
        <p className="eyebrow mt-8">{text.eyebrow}</p>
        <h1 className="mt-3 text-3xl">{text.title}</h1>
        <p className="mt-4 leading-relaxed text-brand-muted">{text.body}</p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {status === 'paid' && (
            <Link to="/dashboard" className="btn-primary">
              Go to dashboard
            </Link>
          )}
          {(status === 'failed' || status === 'missing') && (
            <Link to="/sessions" className="btn-ghost">
              Back to sessions
            </Link>
          )}
          {status === 'pending' && (
            <Link to="/dashboard" className="btn-ghost">
              Check dashboard
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}