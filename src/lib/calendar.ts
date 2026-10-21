export type CalendarSession = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  teacherName?: string | null
  sectionName?: string | null
}

const PRODID = '-//Skillbloom//Sessions//EN'

// Calendar files use UTC times written like 20261102T180000Z
function stamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

// Commas, semicolons, backslashes and line breaks must be escaped inside calendar text
function escapeText(s: string) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Lines longer than 75 characters are split, and each continuation starts with a space
function fold(line: string) {
  const parts = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  return parts.join('\r\n')
}

export function buildIcs(s: CalendarSession, siteUrl: string) {
  const roomUrl = `${siteUrl}/sessions/${s.id}/room`

  const description = [
    s.sectionName ? `Section: ${s.sectionName}` : null,
    s.teacherName ? `Guest teacher: ${s.teacherName}` : null,
    'Join from your Skillbloom session room. The meeting link appears there 15 minutes before the start.',
    roomUrl,
  ]
    .filter(Boolean)
    .join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${s.id}@skillbloom`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(s.starts_at)}`,
    `DTEND:${stamp(s.ends_at)}`,
    `SUMMARY:${escapeText(s.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${roomUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Session starts in 15 minutes',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(s: CalendarSession, siteUrl: string) {
  const content = buildIcs(s, siteUrl)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const fileName =
    s.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'session'

  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}