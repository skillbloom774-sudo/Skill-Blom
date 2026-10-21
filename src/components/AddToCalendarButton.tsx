import { downloadIcs, type CalendarSession } from '../lib/calendar'

export default function AddToCalendarButton({ session }: { session: CalendarSession }) {
  return (
    <button
      type="button"
      onClick={() => downloadIcs(session, window.location.origin)}
      className="btn-ghost px-4 py-2 text-sm"
    >
      Add to calendar
    </button>
  )
}