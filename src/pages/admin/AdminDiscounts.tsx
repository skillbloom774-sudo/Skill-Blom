import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNaira } from '../../lib/sessions'

const PAGE_SIZE = 20

// No 0, O, 1 or I, so codes are easy to read aloud and type
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const MAX_ATTEMPTS = 5

type SessionOption = {
  id: string
  title: string
  starts_at: string
  sections: { name: string } | null
}

type Code = {
  id: string
  code: string
  kind: 'percent' | 'fixed'
  amount: number
  max_uses: number
  uses: number
  expires_at: string | null
  active: boolean
  state: 'active' | 'off' | 'expired' | 'used_up'
  session_count: number
}

type StateFilter = 'all' | Code['state']
const FILTERS: StateFilter[] = ['all', 'active', 'used_up', 'expired', 'off']
const FILTER_LABEL: Record<StateFilter, string> = {
  all: 'All',
  active: 'Active',
  used_up: 'Used up',
  expired: 'Expired',
  off: 'Off',
}

const STATE_PILL: Record<Code['state'], { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-brand-success/10 text-brand-success' },
  off: { label: 'Off', className: 'bg-brand-border/60 text-brand-muted' },
  expired: { label: 'Expired', className: 'bg-brand-error/10 text-brand-error' },
  used_up: { label: 'Used up', className: 'bg-brand-border/60 text-brand-muted' },
}

function generateCode() {
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

function describeDiscount(c: Code) {
  return c.kind === 'percent' ? `${c.amount}% off` : `${formatNaira(c.amount)} off`
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm transition ${
    active
      ? 'bg-brand-primary text-white'
      : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
  }`
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-brand-muted">{hint}</p>}
    </div>
  )
}

export default function AdminDiscounts() {
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [result, setResult] = useState<{ key: string; rows: Code[]; total: number } | null>(null)

  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [filter, setFilter] = useState<StateFilter>('all')
  const [page, setPage] = useState(1)

  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Create-form state
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent')
  const [amount, setAmount] = useState('')
  const [maxUses, setMaxUses] = useState('20')
  const [expires, setExpires] = useState('')
  const [allSessions, setAllSessions] = useState(true)
  const [chosen, setChosen] = useState<string[]>([])

  // Sessions for the "chosen sessions" picker
  useEffect(() => {
    let ignore = false

    supabase
      .from('sessions')
      .select('id, title, starts_at, sections(name)')
      .order('starts_at', { ascending: false })
      .then(({ data, error }) => {
        if (ignore) return
        if (!error) setSessions((data as unknown as SessionOption[]) ?? [])
      })

    return () => {
      ignore = true
    }
  }, [])

  // Codes for the current search, filter and page
  useEffect(() => {
    let ignore = false
    const key = `${query}|${filter}|${page}|${reloadKey}`

    supabase
      .rpc('search_discount_codes', {
        p_query: query || null,
        p_status: filter === 'all' ? null : filter,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      })
      .then(({ data, error }) => {
        if (ignore) return
        if (error) {
          setError(error.message)
          return
        }
        const payload = data as { total: number; rows: Code[] }
        setError(null)
        setResult({ key, rows: payload.rows, total: payload.total })
      })

    return () => {
      ignore = true
    }
  }, [query, filter, page, reloadKey])

  const currentKey = `${query}|${filter}|${page}|${reloadKey}`
  const loading = result?.key !== currentKey
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  function reload() {
    setReloadKey((k) => k + 1)
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    setQuery(draftQuery.trim())
    setPage(1)
  }

  function clearSearch() {
    setDraftQuery('')
    setQuery('')
    setPage(1)
  }

  function chooseFilter(f: StateFilter) {
    setFilter(f)
    setPage(1)
  }

  function toggleSession(id: string) {
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function resetForm() {
    setKind('percent')
    setAmount('')
    setMaxUses('20')
    setExpires('')
    setAllSessions(true)
    setChosen([])
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a discount amount greater than zero.')
      return
    }
    if (kind === 'percent' && value > 100) {
      setError('A percentage discount cannot be more than 100.')
      return
    }

    const uses = Math.floor(Number(maxUses))
    if (!Number.isFinite(uses) || uses < 1) {
      setError('The usage limit must be at least 1.')
      return
    }

    if (!allSessions && chosen.length === 0) {
      setError('Choose at least one session, or pick "All sessions".')
      return
    }

    setBusy(true)

    const storedAmount = kind === 'percent' ? Math.round(value) : Math.round(value * 100)
    const expiresAt = expires ? new Date(expires).toISOString() : null

    // Generate a code, retrying in the unlikely case it already exists
    let createdId: string | null = null
    let createdCode = ''
    let lastError: string | null = null

    for (let attempt = 0; attempt < MAX_ATTEMPTS && !createdId; attempt++) {
      const newCode = generateCode()
      const { data, error: insertError } = await supabase
        .from('discount_codes')
        .insert({
          code: newCode,
          kind,
          amount: storedAmount,
          max_uses: uses,
          expires_at: expiresAt,
          active: true,
        })
        .select('id')
        .single()

      if (data) {
        createdId = data.id
        createdCode = newCode
      } else {
        lastError = insertError?.message ?? 'The code could not be created.'
        if (!insertError?.message.includes('duplicate key')) break
      }
    }

    if (!createdId) {
      setBusy(false)
      setError(lastError ?? 'The code could not be created. Please try again.')
      return
    }

    if (!allSessions) {
      const rowsToLink = chosen.map((session_id) => ({ code_id: createdId!, session_id }))
      const { error: linkError } = await supabase.from('discount_code_sessions').insert(rowsToLink)
      if (linkError) {
        setBusy(false)
        setError(`The code ${createdCode} was saved, but its sessions could not be linked: ${linkError.message}`)
        reload()
        return
      }
    }

    setBusy(false)
    resetForm()
    setNotice(`Code ${createdCode} created. Copy it from the list below to share it.`)
    reload()
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  async function toggleActive(c: Code) {
    setError(null)
    setNotice(null)
    const { error } = await supabase.from('discount_codes').update({ active: !c.active }).eq('id', c.id)
    if (error) setError(error.message)
    else reload()
  }

  async function handleDelete(c: Code) {
    setError(null)
    setNotice(null)

    if (c.uses > 0) {
      setError(`${c.code} has already been used. Switch it off instead, so past purchases keep their record.`)
      return
    }
    if (!confirm(`Delete the code ${c.code}? This cannot be undone.`)) return

    const { error } = await supabase.from('discount_codes').delete().eq('id', c.id)
    if (error) {
      setError(error.message)
    } else {
      setNotice(`Code ${c.code} deleted.`)
      reload()
    }
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-4xl">Discount codes</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Create a code and Skillbloom generates it for you. Set how many students can use it, and whether it
        applies to all sessions or only chosen ones.
      </p>

      {/* Create */}
      <form onSubmit={handleCreate} className="card mt-10 grid gap-6 sm:max-w-2xl">
        <h2 className="text-xl">Create a code</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="d-max" label="Usage limit" hint="How many students can use it in total">
            <input
              id="d-max"
              type="number"
              min="1"
              className="field"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              required
            />
          </Field>
          <Field id="d-kind" label="Discount type">
            <select id="d-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off (₦)</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="d-amount"
            label={kind === 'percent' ? 'Percentage' : 'Amount (₦)'}
            hint={kind === 'percent' ? 'Between 1 and 100' : 'Taken off the session price'}
          >
            <input
              id="d-amount"
              type="number"
              min="1"
              step={kind === 'percent' ? '1' : '100'}
              className="field"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field id="d-expires" label="Expires (optional)" hint="Leave empty for no end date">
            <input
              id="d-expires"
              type="datetime-local"
              className="field"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3">
          <p className="label">Applies to</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAllSessions(true)} className={chipClass(allSessions)}>
              All sessions
            </button>
            <button type="button" onClick={() => setAllSessions(false)} className={chipClass(!allSessions)}>
              Chosen sessions
            </button>
          </div>

          {!allSessions && (
            <div className="mt-2 grid gap-2">
              {sessions.length === 0 && (
                <p className="text-sm text-brand-muted">No sessions yet. Create a session first.</p>
              )}
              {sessions.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm transition hover:border-brand-primary"
                >
                  <input
                    type="checkbox"
                    checked={chosen.includes(s.id)}
                    onChange={() => toggleSession(s.id)}
                    className="h-4 w-4 accent-brand-primary"
                  />
                  <span className="text-brand-text">{s.title}</span>
                  <span className="ml-auto text-brand-muted">{s.sections?.name ?? ''}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-brand-error">{error}</p>}
        {notice && <p className="text-sm text-brand-success">{notice}</p>}

        <div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Generating' : 'Create code'}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="mt-16">
        <h2 className="text-2xl">All codes</h2>

        <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="field sm:max-w-md"
            placeholder="Search by code"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            aria-label="Search discount codes"
          />
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Search</button>
            {query && (
              <button type="button" onClick={clearSearch} className="btn-ghost">Clear</button>
            )}
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => chooseFilter(f)} className={chipClass(filter === f)}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        {result === null && !error && <p className="mt-8 text-brand-muted">Loading codes</p>}
        {result !== null && !loading && total === 0 && (
          <p className="mt-8 text-brand-muted">
            {query || filter !== 'all' ? 'No codes match these filters.' : 'No codes yet. Create your first one above.'}
          </p>
        )}

        <div className={`mt-6 grid gap-4 transition ${loading ? 'opacity-50' : ''}`}>
          {rows.map((c) => {
            const pill = STATE_PILL[c.state]
            const scope = c.session_count > 0 ? `${c.session_count} ${c.session_count === 1 ? 'session' : 'sessions'}` : 'All sessions'

            return (
              <div key={c.id} className="card flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-lg font-semibold tracking-widest text-brand-text">{c.code}</span>
                    <button
                      onClick={() => copyCode(c.code)}
                      className="rounded-full border border-brand-border px-3 py-1 text-xs font-medium text-brand-muted transition hover:border-brand-primary hover:text-brand-primary"
                    >
                      {copied === c.code ? 'Copied' : 'Copy'}
                    </button>
                    <span className={`pill ${pill.className}`}>{pill.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-brand-text">{describeDiscount(c)}</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {c.uses} of {c.max_uses} used · {scope}
                    {c.expires_at && (
                      <>
                        {' '}· Expires{' '}
                        {new Date(c.expires_at).toLocaleDateString('en-NG', {
                          timeZone: 'Africa/Lagos',
                          dateStyle: 'medium',
                        })}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 gap-5 text-sm">
                  <button onClick={() => toggleActive(c)} className="text-brand-primary hover:underline">
                    {c.active ? 'Switch off' : 'Switch on'}
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={c.uses > 0}
                    title={c.uses > 0 ? 'Used codes can be switched off but not deleted' : 'Delete code'}
                    className="text-brand-error hover:underline disabled:cursor-not-allowed disabled:text-brand-muted disabled:no-underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {total > 0 && (
          <div className="mt-10 flex items-center justify-between gap-4 border-t border-brand-border pt-8">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || loading}
              className="btn-ghost disabled:opacity-40"
            >
              Previous
            </button>
            <p className="text-sm text-brand-muted">
              {from}–{to} of {total}
            </p>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pages || loading}
              className="btn-ghost disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  )
}