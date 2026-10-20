import { Link } from 'react-router-dom'
import { formatNaira, teacherPhotoUrl, type SessionListItem } from '../lib/sessions'

const LAGOS = 'Africa/Lagos'

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function SessionCard({ session }: { session: SessionListItem }) {
  const start = new Date(session.starts_at)
  const month = new Intl.DateTimeFormat('en-NG', { month: 'short', timeZone: LAGOS }).format(start)
  const day = new Intl.DateTimeFormat('en-NG', { day: 'numeric', timeZone: LAGOS }).format(start)
  const time = new Intl.DateTimeFormat('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: LAGOS,
  }).format(start)

  const teacher = session.guest_teachers
  const photo = teacherPhotoUrl(teacher?.photo_path ?? null)

  return (
    <Link
      to={`/sessions/${session.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start gap-5 p-6">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-brand-primary-soft py-3 text-brand-primary">
          <span className="text-xs font-semibold uppercase tracking-wider">{month}</span>
          <span className="mt-0.5 font-serif text-2xl leading-none">{day}</span>
        </div>

        <div className="min-w-0 pt-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">
            {session.sections?.name}
          </p>
          <h3 className="mt-2 text-xl leading-snug transition group-hover:text-brand-primary">
            {session.title}
          </h3>
          <p className="mt-2 text-sm text-brand-muted">{time} WAT</p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-4 border-t border-brand-border px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {photo ? (
            <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-medium text-white">
              {teacher ? initials(teacher.name) : '—'}
            </span>
          )}
          <p className="truncate text-sm text-brand-text">
            {teacher ? teacher.name : 'Teacher to be announced'}
          </p>
        </div>
        <p className="shrink-0 font-serif text-lg text-brand-primary">
          {formatNaira(session.price_kobo)}
        </p>
      </div>
    </Link>
  )
}