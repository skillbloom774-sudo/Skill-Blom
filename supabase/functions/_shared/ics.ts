export type FeedSession = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  teacher_name: string | null
  section_name: string | null
}

// Calendar files use UTC times such as 20261102T180000Z
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

export function buildFeed(sessions: FeedSession[], siteUrl: string): string {
  const now = stamp(new Date().toISOString())

  const events = sessions.flatMap((s) => {
    const roomUrl = `${siteUrl}/sessions/${s.id}/room`

    const description = [
      s.section_name ? `Section: ${s.section_name}` : null,
      s.teacher_name ? `Guest teacher: ${s.teacher_name}` : null,
      'Join from your Skillbloom session room. The meeting link appears there 15 minutes before the start.',
      roomUrl,
    ]
      .filter(Boolean)
      .join('\n')

    return [
      'BEGIN:VEVENT',
      `UID:${s.id}@skillbloom`,
      `DTSTAMP:${now}`,
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
    ]
  })

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Skillbloom//Sessions//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Skillbloom sessions',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...events,
    'END:VCALENDAR',
  ]

  return lines.map(fold).join('\r\n') + '\r\n'
}