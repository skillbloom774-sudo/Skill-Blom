import { formatNaira } from '../lib/sessions'

export type Series = {
  name: string
  color: string
  values: (number | null)[]
}

const W = 640
const H = 240
const PAD = { top: 16, right: 16, bottom: 40, left: 64 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const GRID = 4

// Rounds the top of an axis up to a tidy number, such as 1, 2, 5 or 10 times a power of ten
function niceMax(v: number) {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nice * exp
}

// Short money labels for the axis, so large amounts fit beside the chart
export function compactNaira(kobo: number) {
  const n = kobo / 100
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`
  return `₦${Math.round(n)}`
}

function Axes({
  max,
  axisFormat,
  labels,
  xFor,
}: {
  max: number
  axisFormat: (v: number) => string
  labels: string[]
  xFor: (i: number) => number
}) {
  // Show at most about eight labels, so they never crowd each other
  const step = Math.max(1, Math.ceil(labels.length / 8))

  return (
    <>
      {Array.from({ length: GRID + 1 }, (_, i) => {
        const y = PAD.top + PLOT_H - (PLOT_H * i) / GRID
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#E4E7EC" />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#667085">
              {axisFormat((max * i) / GRID)}
            </text>
          </g>
        )
      })}
      {labels.map((label, i) =>
        i % step === 0 ? (
          <text key={i} x={xFor(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="#667085">
            {label}
          </text>
        ) : null,
      )}
    </>
  )
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-5 text-sm text-brand-muted">
      {series.map((s) => (
        <span key={s.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}

export function BarChart({
  label,
  labels,
  values,
  axisFormat,
  tipFormat,
  color,
}: {
  label: string
  labels: string[]
  values: number[]
  axisFormat: (v: number) => string
  tipFormat: (v: number) => string
  color: string
}) {
  const max = niceMax(Math.max(0, ...values))
  const band = PLOT_W / Math.max(1, labels.length)
  const barW = Math.min(44, band * 0.6)
  const xFor = (i: number) => PAD.left + band * (i + 0.5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      <Axes max={max} axisFormat={axisFormat} labels={labels} xFor={xFor} />
      {values.map((v, i) => {
        const h = (v / max) * PLOT_H
        return (
          <rect
            key={i}
            x={xFor(i) - barW / 2}
            y={PAD.top + PLOT_H - h}
            width={barW}
            height={h}
            rx={4}
            fill={color}
          >
            <title>{`${labels[i]}: ${tipFormat(v)}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

export function LineChart({
  label,
  labels,
  series,
  axisFormat,
  tipFormat,
}: {
  label: string
  labels: string[]
  series: Series[]
  axisFormat: (v: number) => string
  tipFormat: (v: number) => string
}) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null)
  const max = niceMax(Math.max(0, ...all))
  const n = labels.length
  const xFor = (i: number) => PAD.left + (n > 1 ? (PLOT_W * i) / (n - 1) : PLOT_W / 2)
  const yFor = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      <Axes max={max} axisFormat={axisFormat} labels={labels} xFor={xFor} />
      {series.map((s) => {
        // Build the line one run at a time, so gaps (null values) are not joined across
        let d = ''
        s.values.forEach((v, i) => {
          if (v === null) return
          const move = i === 0 || s.values[i - 1] === null ? 'M' : 'L'
          d += `${move}${xFor(i)},${yFor(v)} `
        })

        return (
          <g key={s.name}>
            <path d={d.trim()} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" />
            {s.values.map((v, i) =>
              v === null ? null : (
                <circle key={i} cx={xFor(i)} cy={yFor(v)} r={3.5} fill={s.color}>
                  <title>{`${s.name}, ${labels[i]}: ${tipFormat(v)}`}</title>
                </circle>
              ),
            )}
          </g>
        )
      })}
    </svg>
  )
}

export { formatNaira }