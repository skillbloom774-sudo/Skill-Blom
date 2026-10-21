import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

const PASS_MARK = 50

type Status = {
  total: number
  marked: number
  average: number
  pass_mark: number
  eligible: boolean
  certificate_number: string | null
}

export default function CertificatePanel({ sessionId }: { sessionId: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [purchaseId, setPurchaseId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Find this student's paid purchase for the session. Teachers and admins have none.
  useEffect(() => {
    if (!user) return
    let ignore = false

    supabase
      .from('purchases')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', user.id)
      .eq('status', 'paid')
      .maybeSingle()
      .then(({ data }) => {
        if (!ignore) setPurchaseId(data?.id ?? null)
      })

    return () => {
      ignore = true
    }
  }, [sessionId, user])

  useEffect(() => {
    if (!purchaseId) return
    let ignore = false

    supabase.rpc('certificate_status', { p_purchase_id: purchaseId }).then(({ data, error }) => {
      if (ignore) return
      if (error) setError(error.message)
      else setStatus(data as Status)
    })

    return () => {
      ignore = true
    }
  }, [purchaseId, reloadKey])

  if (!user || !purchaseId || !status) return null

  async function getCertificate() {
    if (!purchaseId) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('issue_certificate', { p_purchase_id: purchaseId })
    setBusy(false)

    if (error) {
      setError(error.message)
      setReloadKey((k) => k + 1)
      return
    }
    navigate(`/certificates/${data}`)
  }

  const percent = status.total > 0 ? Math.round((status.marked / status.total) * 100) : 0

  return (
    <div className="card mt-10">
      <p className="eyebrow">Certificate</p>

      {status.certificate_number ? (
        <>
          <h2 className="mt-3 text-xl">Your certificate is ready</h2>
          <Link to={`/certificates/${status.certificate_number}`} className="btn-primary mt-6 w-fit">
            View certificate
          </Link>
        </>
      ) : status.total === 0 ? (
        <p className="mt-3 leading-relaxed text-brand-muted">
          Your teacher hasn't added any assignments or tests to this session yet, so there is no certificate to
          earn here yet.
        </p>
      ) : status.eligible ? (
        <>
          <h2 className="mt-3 text-xl">You've earned your certificate</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-muted">
            Every assignment and test is marked, with an average of {status.average}%.
          </p>
          <button onClick={getCertificate} disabled={busy} className="btn-primary mt-6 w-fit">
            {busy ? 'Creating certificate' : 'Get certificate'}
          </button>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-xl">Working towards your certificate</h2>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-brand-border">
            <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            {status.marked} of {status.total} assignments and tests marked. Your average so far is{' '}
            {status.average}%. You need every item marked and an average of at least {PASS_MARK}% to earn the
            certificate.
          </p>
        </>
      )}

      {error && <p className="mt-4 text-sm text-brand-error">{error}</p>}
    </div>
  )
}