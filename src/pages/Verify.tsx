import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type VerifyResult = {
  valid: boolean
  session?: string
  month?: string
  access_ends_at?: string
  reason?: string
}

function StatusMark({ valid }: { valid: boolean }) {
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-full ${
        valid ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {valid ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
      </svg>
    </div>
  )
}

export default function Verify() {
  const { cardId } = useParams()
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cardId) return
    let ignore = false

    supabase.rpc('verify_card', { p_card_id: cardId }).then(({ data, error }) => {
      if (ignore) return
      if (error) setError(error.message)
      else setResult(data as VerifyResult)
    })

    return () => {
      ignore = true
    }
  }, [cardId])

  return (
    <section className="container-page py-16 sm:py-20">
      <div className="card mx-auto max-w-lg p-8 sm:p-10">
        <p className="eyebrow">Card check</p>

        {error && (
          <>
            <h1 className="mt-4 text-3xl">Could not check this card</h1>
            <p className="mt-3 text-brand-muted">Please try again in a moment.</p>
          </>
        )}

        {!error && !result && <h1 className="mt-4 text-3xl">Checking card</h1>}

        {result && (
          <>
            <div className="mt-6">
              <StatusMark valid={result.valid} />
            </div>

            {result.valid ? (
              <>
                <h1 className="mt-6 text-3xl text-brand-success">Valid card</h1>
                <dl className="mt-8 grid gap-5 border-t border-brand-border pt-8 text-sm">
                  <div>
                    <dt className="text-brand-muted">Session</dt>
                    <dd className="mt-1 text-base text-brand-text">{result.session}</dd>
                  </div>
                  <div>
                    <dt className="text-brand-muted">Month</dt>
                    <dd className="mt-1 text-brand-text">{result.month}</dd>
                  </div>
                  <div>
                    <dt className="text-brand-muted">Access until</dt>
                    <dd className="mt-1 text-brand-text">
                      {result.access_ends_at &&
                        new Date(result.access_ends_at).toLocaleDateString('en-NG', {
                          timeZone: 'Africa/Lagos',
                          dateStyle: 'long',
                        })}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <h1 className="mt-6 text-3xl text-brand-error">Not valid</h1>
                <p className="mt-4 text-brand-muted">
                  {result.reason ?? 'This card has expired or is not active.'}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}