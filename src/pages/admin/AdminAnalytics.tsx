import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatNaira } from '../../lib/sessions'
import PageHeader from '../../components/PageHeader'

type SectionRow = { name: string; paid_count: number; revenue_kobo: number }
type TopSession = { id: string; title: string; section_name: string; paid_count: number; views: number }
type MonthRow = { month: string; paid_count: number; revenue_kobo: number }

type Summary = {
  revenue_kobo: number
  paid_count: number
  views: number
  by_section: SectionRow[]
  top_sessions: TopSession[]
  monthly: MonthRow[]
}

type RangeKey = '30' | '90' | 'all' | 'custom'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
]

// Dates in Lagos time, written as YYYY-MM-DD
function lagosDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return lagosDate(d)
}

function percent(part: number, whole: number) {
  if (whole <= 0) return null
  return ((part / whole) * 100).toFixed(1)
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm transition ${
    active
      ? 'bg-brand-primary text-white'
      : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
  }`
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="eyebrow">{label}</p>
      <p className="mt-4 font-serif text-3xl text-brand-text">{value}</p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-brand-muted">{hint}</p>}
    </div>
  )
}

export default function AdminAnalytics() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('30')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [result, setResult] = useState<{ key: string; summary: Summary } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const from =
    rangeKey === '30' ? daysAgo(29) : rangeKey === '90' ? daysAgo(89) : rangeKey === 'custom' ? customFrom : ''
  const to = rangeKey === 'all' ? '' : rangeKey === 'custom' ? customTo : lagosDate(new Date())
  const key = `${rangeKey}|${from}|${to}`

  useEffect(() => {
    let ignore = false

    supabase
      .rpc('analytics_summary', {
        p_from: from || null,
        p_to: to || null,
      })
      .then(({ data, error }) => {
        if (ignore) return
        if (error) {
          setError(error.message)
          return
        }
        setError(null)
        setResult({ key, summary: data as Summary })
      })

    return () => {
      ignore = true
    }
  }, [key, from, to])

  const loading = result?.key !== key
  const summary = result?.summary ?? null
  const conversion = summary ? percent(summary.paid_count, summary.views) : null
  const maxRevenue = summary ? Math.max(1, ...summary.monthly.map((m) => m.revenue_kobo)) : 1
  const maxSectionRevenue = summary ? Math.max(1, ...summary.by_section.map((s) => s.revenue_kobo)) : 1

  return (
    <section className="container-page py-14 sm:py-20">
      <PageHeader
        eyebrow="Admin"
        title="Analytics"
        description="How sales and visits are doing. Only you can see these figures."
      />

      <div className="mt-10 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRangeKey(r.key)} className={chipClass(rangeKey === r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      {rangeKey === 'custom' && (
        <div className="mt-5 grid max-w-xl gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="an-from">From</label>
            <input id="an-from" type="date" className="field" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="an-to">To</label>
            <input id="an-to" type="date" className="field" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        </div>
      )}

      {error && <p className="mt-8 text-sm text-brand-error">{error}</p>}
      {summary === null && !error && <p className="mt-10 text-brand-muted">Loading analytics</p>}

      {summary && (
        <div className={`transition ${loading ? 'opacity-50' : ''}`}>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Revenue" value={formatNaira(summary.revenue_kobo)} hint="Paid purchases only. Refunds are not counted." />
            <StatCard label="Paid students" value={String(summary.paid_count)} />
            <StatCard label="Page views" value={String(summary.views)} hint="Session page visits, one per visitor per day." />
            <StatCard
              label="Conversion"
              value={conversion === null ? '—' : `${conversion}%`}
              hint="Paid students divided by page views. An estimate, since views are counted per day."
            />
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl">Sales by section</h2>
              {summary.by_section.length === 0 && (
                <p className="mt-4 text-sm text-brand-muted">No sales in this period.</p>
              )}
              <div className="mt-5 grid gap-4">
                {summary.by_section.map((s) => (
                  <div key={s.name} className="card">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-brand-text">{s.name}</p>
                      <p className="font-serif text-lg text-brand-text">{formatNaira(s.revenue_kobo)}</p>
                    </div>
                    <p className="mt-1 text-sm text-brand-muted">
                      {s.paid_count} paid {s.paid_count === 1 ? 'student' : 'students'}
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-border">
                      <div
                        className="h-full rounded-full bg-brand-primary"
                        style={{ width: `${(s.revenue_kobo / maxSectionRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl">Monthly revenue</h2>
              {summary.monthly.length === 0 && (
                <p className="mt-4 text-sm text-brand-muted">No sales in this period.</p>
              )}
              <div className="mt-5 grid gap-4">
                {summary.monthly.map((m) => (
                  <div key={m.month} className="card">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-brand-text">{m.month}</p>
                      <p className="font-serif text-lg text-brand-text">{formatNaira(m.revenue_kobo)}</p>
                    </div>
                    <p className="mt-1 text-sm text-brand-muted">
                      {m.paid_count} paid {m.paid_count === 1 ? 'student' : 'students'}
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-border">
                      <div
                        className="h-full rounded-full bg-brand-accent"
                        style={{ width: `${(m.revenue_kobo / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-14">
            <h2 className="text-2xl">Popular sessions</h2>
            {summary.top_sessions.length === 0 && (
              <p className="mt-4 text-sm text-brand-muted">No sessions have views or sales in this period.</p>
            )}
            <div className="mt-5 divide-y divide-brand-border border-t border-brand-border">
              {summary.top_sessions.map((s) => {
                const sessionConversion = percent(s.paid_count, s.views)
                return (
                  <div key={s.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="eyebrow">{s.section_name}</p>
                      <Link
                        to={`/admin/sessions/${s.id}`}
                        className="mt-1 block text-lg font-medium text-brand-text transition hover:text-brand-primary"
                      >
                        {s.title}
                      </Link>
                    </div>
                    <div className="flex shrink-0 gap-8 text-sm">
                      <div>
                        <p className="text-brand-muted">Views</p>
                        <p className="mt-1 font-medium text-brand-text">{s.views}</p>
                      </div>
                      <div>
                        <p className="text-brand-muted">Paid</p>
                        <p className="mt-1 font-medium text-brand-text">{s.paid_count}</p>
                      </div>
                      <div>
                        <p className="text-brand-muted">Conversion</p>
                        <p className="mt-1 font-medium text-brand-text">
                          {sessionConversion === null ? '—' : `${sessionConversion}%`}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}