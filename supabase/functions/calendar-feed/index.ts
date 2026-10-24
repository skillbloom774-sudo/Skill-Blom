import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildFeed, type FeedSession } from '../_shared/ics.ts'

const TOKEN_PATTERN = /^[0-9a-f]{64}$/

type SessionRow = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  status: string
  guest_teachers: { name: string } | null
  sections: { name: string } | null
}

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!TOKEN_PATTERN.test(token)) return text('Not found', 404)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: owner } = await admin
    .from('calendar_tokens')
    .select('student_id')
    .eq('token', token)
    .maybeSingle()
  if (!owner) return text('Not found', 404)

  // Paid, still within access, and the session itself is published
  const { data, error } = await admin
    .from('purchases')
    .select('sessions(id, title, starts_at, ends_at, status, guest_teachers(name), sections(name))')
    .eq('student_id', owner.student_id)
    .eq('status', 'paid')
    .gt('access_ends_at', new Date().toISOString())

  if (error) {
    console.error('Calendar feed failed', error)
    return text('The calendar could not be loaded. Please try again later.', 500)
  }

  // Option A: only sessions that haven't finished yet
  const nowMs = Date.now()
  const sessions: FeedSession[] = ((data ?? []) as unknown as { sessions: SessionRow | null }[])
    .map((r) => r.sessions)
    .filter(
      (s): s is SessionRow =>
        s !== null && s.status === 'published' && new Date(s.ends_at).getTime() > nowMs,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((s) => ({
      id: s.id,
      title: s.title,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      teacher_name: s.guest_teachers?.name ?? null,
      section_name: s.sections?.name ?? null,
    }))

  return new Response(buildFeed(sessions, Deno.env.get('SITE_URL') ?? ''), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, max-age=900',
    },
  })
})