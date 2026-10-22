import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import Turnstile from '../components/Turnstile'

type Mode = 'signin' | 'signup' | 'forgot' | 'verify'

const HEADINGS: Record<Mode, { eyebrow: string; title: string }> = {
  signin: { eyebrow: 'Welcome back', title: 'Sign in to Skillbloom' },
  signup: { eyebrow: 'Get started', title: 'Create your account' },
  forgot: { eyebrow: 'Account help', title: 'Reset your password' },
  verify: { eyebrow: 'Almost there', title: 'Check your email' },
}

const MAX_FAILED_SIGNINS = 5
const LOCKOUT_SECONDS = 60
const CAPTCHA_ENABLED = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)

const ALREADY_REGISTERED =
  'This email is already registered and cannot be used to create a new account. Sign in instead, or use Forgot password if you can\'t remember your password.'

function friendlyError(message: string) {
  const lower = message.toLowerCase()

  if (message === 'Invalid login credentials') {
    return "That email and password don't match. Check for typos, or use Forgot password to set a new one."
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return ALREADY_REGISTERED
  }
  if (lower.includes('password should be at least')) {
    return 'Your password needs at least 6 characters.'
  }
  if (lower.includes('captcha')) {
    return 'The security check did not pass. Please complete it again.'
  }
  if (lower.includes('email_send_rate_limit') || lower.includes('email rate limit')) {
    return 'Too many emails have been requested for this address. Please wait a few minutes before trying again.'
  }
  if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('for security purposes')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  return message
}

export default function Login() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)

  const failedSignins = useRef(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Counts down the lockout and clears it when time is up
  useEffect(() => {
    if (!lockedUntil) return
    const timer = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= lockedUntil) {
        setLockedUntil(null)
        failedSignins.current = 0
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [lockedUntil])

  const lockedSeconds = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0

  // Anyone already signed in goes straight to their dashboard
  if (!loading && user) return <Navigate to="/dashboard" replace />

  function resetCaptcha() {
    setCaptchaToken(null)
    setCaptchaReset((k) => k + 1)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    resetCaptcha()
  }

  function captchaMissing() {
    return CAPTCHA_ENABLED && !captchaToken
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'signup' && !consent) {
      setError('Please accept the terms and privacy notice to continue.')
      return
    }
    if (captchaMissing()) {
      setError('Please complete the security check first.')
      return
    }

    setBusy(true)

    // Emails are stored in lowercase so the same address never creates two accounts
    const cleanEmail = email.trim().toLowerCase()
    const captchaOptions = { captchaToken: captchaToken ?? undefined }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/set-password`,
        ...captchaOptions,
      })
      setBusy(false)
      resetCaptcha()
      if (error) setError(friendlyError(error.message))
      else setNotice('If an account exists for that email, a reset link is on its way. Check your spam folder too.')
      return
    }

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
        options: captchaOptions,
      })
      setBusy(false)
      resetCaptcha()

      if (!error) {
        failedSignins.current = 0
        navigate('/dashboard')
        return
      }

      if (error.message.toLowerCase().includes('email not confirmed')) {
        setPendingEmail(cleanEmail)
        setMode('verify')
        resetCaptcha()
        return
      }

      failedSignins.current += 1
      if (failedSignins.current >= MAX_FAILED_SIGNINS) {
        setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000)
        setNow(Date.now())
        setError(`Too many failed attempts. Wait ${LOCKOUT_SECONDS} seconds before trying again.`)
        return
      }

      setError(friendlyError(error.message))
      return
    }

    // Sign up
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: `${window.location.origin}/login`,
        ...captchaOptions,
      },
    })
    setBusy(false)
    resetCaptcha()

    if (error) {
      setError(friendlyError(error.message))
      return
    }

    // Supabase returns a user with no identities when the email already has an account.
    // No new account or email is created in that case, so tell the person clearly.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError(ALREADY_REGISTERED)
      return
    }

    if (data.session) {
      navigate('/dashboard')
      return
    }

    setPendingEmail(cleanEmail)
    setMode('verify')
  }

  async function resendEmail() {
    setError(null)
    setNotice(null)

    if (captchaMissing()) {
      setError('Please complete the security check first.')
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        captchaToken: captchaToken ?? undefined,
      },
    })
    setBusy(false)
    resetCaptcha()

    if (error) setError(friendlyError(error.message))
    else setNotice('A new link is on its way. Check your inbox and spam folder.')
  }

  const heading = HEADINGS[mode]
  const locked = lockedSeconds > 0
  const submitLabel =
    mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'

  return (
    <section className="container-page py-10 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden rounded-[2.5rem] bg-brand-primary p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-accent/90" aria-hidden />
          <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-white/5" aria-hidden />

          <div className="relative flex items-center gap-3">
            <img src="/logo.svg" alt="" className="h-10 w-10" />
            <span className="font-serif text-2xl">Skillbloom</span>
          </div>

          <div className="relative">
            <h2 className="text-4xl leading-tight text-white">Learn live. Ask anything. Keep the work.</h2>
            <p className="mt-5 max-w-sm leading-relaxed text-white/75">
              Monthly sessions taught by working practitioners, with classwork, tests, and a chat that
              keeps you connected.
            </p>
          </div>
        </aside>

        <div className="card mx-auto w-full max-w-md self-center p-8 sm:p-10">
          <p className="eyebrow">{heading.eyebrow}</p>
          <h1 className="mt-3 text-3xl">{heading.title}</h1>

          {mode === 'verify' ? (
            <div className="mt-8 grid gap-6">
              <p className="leading-relaxed text-brand-text">
                We sent a confirmation link to <span className="font-medium">{pendingEmail}</span>. Open it to
                activate your account, then come back here to sign in.
              </p>
              <p className="text-sm leading-relaxed text-brand-muted">
                If the email doesn't arrive within a few minutes, check your spam folder, or ask for a new link.
              </p>

              {CAPTCHA_ENABLED && (
                <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
              )}

              {error && <p className="text-sm text-brand-error">{error}</p>}
              {notice && <p className="text-sm text-brand-success">{notice}</p>}

              <button onClick={resendEmail} disabled={busy} className="btn-primary w-full">
                {busy ? 'Please wait' : 'Resend confirmation email'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="label" htmlFor="name">Full name</label>
                    <input id="name" className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label" htmlFor="phone">Phone number</label>
                    <input id="phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                </>
              )}

              <div>
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="label" htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    className="field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              )}

              {mode === 'signup' && (
                <label className="flex items-start gap-3 text-sm leading-relaxed text-brand-muted">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-brand-primary"
                  />
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" className="text-brand-primary underline">Terms</Link> and the{' '}
                    <Link to="/privacy" className="text-brand-primary underline">Privacy Notice</Link>.
                  </span>
                </label>
              )}

              {CAPTCHA_ENABLED && (
                <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
              )}

              {error && <p className="text-sm text-brand-error">{error}</p>}
              {notice && <p className="text-sm text-brand-success">{notice}</p>}

              <button type="submit" disabled={busy || locked} className="btn-primary w-full">
                {locked ? `Try again in ${lockedSeconds}s` : busy ? 'Please wait' : submitLabel}
              </button>
            </form>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-brand-border pt-6 text-sm text-brand-muted">
            {mode === 'signin' && (
              <>
                <button onClick={() => switchMode('forgot')} className="w-fit transition hover:text-brand-primary">
                  Forgot password?
                </button>
                <button onClick={() => switchMode('signup')} className="w-fit transition hover:text-brand-primary">
                  Don't have an account? Create one
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button onClick={() => switchMode('signin')} className="w-fit transition hover:text-brand-primary">
                Already have an account? Sign in
              </button>
            )}
            {mode === 'forgot' && (
              <button onClick={() => switchMode('signin')} className="w-fit transition hover:text-brand-primary">
                Back to sign in
              </button>
            )}
            {mode === 'verify' && (
              <>
                <button onClick={() => switchMode('signin')} className="w-fit transition hover:text-brand-primary">
                  I've confirmed my email. Sign in
                </button>
                <button onClick={() => switchMode('signup')} className="w-fit transition hover:text-brand-primary">
                  Use a different email
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}