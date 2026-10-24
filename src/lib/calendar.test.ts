import { describe, expect, it } from 'vitest'
import { buildIcs } from './calendar'

const SESSION = {
  id: '11111111-2222-3333-4444-555555555555',
  title: 'Brand systems, for small businesses',
  starts_at: '2026-11-02T18:00:00.000Z',
  ends_at: '2026-11-02T20:00:00.000Z',
  teacherName: 'Ada Okafor',
  sectionName: 'Graphic Design',
}

const SITE = 'https://example.com'

describe('buildIcs', () => {
  it('writes start and end times in UTC', () => {
    const ics = buildIcs(SESSION, SITE)
    expect(ics).toContain('DTSTART:20261102T180000Z')
    expect(ics).toContain('DTEND:20261102T200000Z')
  })

  it('escapes commas in the title', () => {
    expect(buildIcs(SESSION, SITE)).toContain('SUMMARY:Brand systems\\, for small businesses')
  })

  it('sets a reminder 15 minutes before the start', () => {
    expect(buildIcs(SESSION, SITE)).toContain('TRIGGER:-PT15M')
  })

  it('links to the session room', () => {
    expect(buildIcs(SESSION, SITE)).toContain(
      'https://example.com/sessions/11111111-2222-3333-4444-555555555555/room',
    )
  })

  it('keeps every line within 75 characters', () => {
    const long = { ...SESSION, title: 'x'.repeat(200) }
    const lines = buildIcs(long, SITE).split('\r\n')
    expect(lines.every((line) => line.length <= 75)).toBe(true)
  })
})