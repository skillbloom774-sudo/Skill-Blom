import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Cert = {
  valid: boolean
  certificate_number?: string
  student_name?: string
  session_title?: string
  section?: string | null
  teacher?: string | null
  average?: number
  issued_at?: string
}

export default function Certificate() {
  const { number } = useParams()
  const [cert, setCert] = useState<Cert | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!number) return
    let ignore = false

    supabase.rpc('get_certificate', { p_number: number }).then(({ data, error }) => {
      if (ignore) return
      if (error) setError(error.message)
      else setCert(data as Cert)
    })

    return () => {
      ignore = true
    }
  }, [number])

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (error) {
    return (
      <section className="container-page py-16">
        <p className="text-sm text-brand-error">{error}</p>
      </section>
    )
  }

  if (!cert) return <p className="container-page py-16 text-brand-muted">Checking certificate</p>

  if (!cert.valid) {
    return (
      <section className="container-page py-16 sm:py-24">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <p className="eyebrow">Certificate check</p>
          <h1 className="mt-3 text-3xl text-brand-error">Not valid</h1>
          <p className="mt-4 leading-relaxed text-brand-muted">
            This certificate number doesn't match a valid certificate. It may have been mistyped, or the
            purchase may have been refunded.
          </p>
        </div>
      </section>
    )
  }

  const issued = cert.issued_at
    ? new Date(cert.issued_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'long' })
    : ''

  return (
    <section className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <Link to="/dashboard" className="text-sm text-brand-muted transition hover:text-brand-primary">
            ← Dashboard
          </Link>
          <div className="flex gap-3">
            <button onClick={copyLink} className="btn-ghost px-4 py-2 text-sm">
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            <button onClick={() => window.print()} className="btn-primary px-4 py-2 text-sm">
              Save as PDF
            </button>
          </div>
        </div>

        <div className="mt-8 border-[10px] border-double border-brand-primary/80 bg-white p-10 text-center sm:p-16 print:mt-0">
          <img src="/logo.svg" alt="" className="mx-auto h-14 w-14" />
          <p className="eyebrow mt-6">Certificate of completion</p>
          <p className="mt-8 text-brand-muted">This certifies that</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{cert.student_name}</h1>
          <p className="mt-8 text-brand-muted">has completed</p>
          <p className="mt-3 font-serif text-2xl text-brand-text sm:text-3xl">{cert.session_title}</p>
          <p className="mt-3 text-sm text-brand-muted">
            {cert.section ? `${cert.section} · ` : ''}
            {cert.teacher ? `taught by ${cert.teacher}` : ''}
          </p>

          <div className="mt-12 grid gap-6 border-t border-brand-border pt-8 text-sm sm:grid-cols-3">
            <div>
              <p className="eyebrow">Average score</p>
              <p className="mt-2 text-brand-text">{cert.average}%</p>
            </div>
            <div>
              <p className="eyebrow">Issued</p>
              <p className="mt-2 text-brand-text">{issued}</p>
            </div>
            <div>
              <p className="eyebrow">Certificate ID</p>
              <p className="mt-2 font-mono tracking-widest text-brand-text">{cert.certificate_number}</p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-brand-muted print:hidden">
          Anyone with this link can check that the certificate is genuine.
        </p>
      </div>
    </section>
  )
}