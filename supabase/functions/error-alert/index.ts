import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

Deno.serve(async (req) => {
  // Only the database trigger knows this secret
  if (req.headers.get('x-alert-secret') !== Deno.env.get('ERROR_ALERT_SECRET')) {
    return new Response('unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.id) return new Response('missing id', { status: 400 })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: row } = await admin
    .from('error_logs')
    .select('message, stack, path, source, created_at')
    .eq('id', body.id)
    .maybeSingle()
  if (!row) return new Response('not found', { status: 404 })

  const to = Deno.env.get('ALERT_EMAIL')
  if (!to) return new Response('ALERT_EMAIL not set', { status: 500 })

  const when = new Date(row.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })

  const html = `
<div style="font-family: Inter, Arial, sans-serif; color:#1F2430; padding:24px;">
  <h2 style="font-family: Georgia, serif; color:#1B2A4A; margin:0 0 16px;">New problem on Skillbloom</h2>
  <table style="border-collapse:collapse; font-size:14px; margin-bottom:16px;">
    <tr><td style="padding:4px 16px 4px 0; color:#667085;">When</td><td>${esc(when)}</td></tr>
    <tr><td style="padding:4px 16px 4px 0; color:#667085;">Page</td><td>${esc(row.path ?? '')}</td></tr>
    <tr><td style="padding:4px 16px 4px 0; color:#667085;">Source</td><td>${esc(row.source ?? '')}</td></tr>
  </table>
  <p style="font-weight:600; margin:0 0 8px;">Message</p>
  <pre style="background:#F7F8FA; padding:12px; white-space:pre-wrap; font-size:13px;">${esc(row.message)}</pre>
  <p style="font-weight:600; margin:16px 0 8px;">Stack trace</p>
  <pre style="background:#F7F8FA; padding:12px; white-space:pre-wrap; font-size:12px;">${esc(row.stack ?? 'None recorded')}</pre>
  <p style="font-size:12px; color:#667085;">Full log: Supabase Table Editor, table error_logs.</p>
</div>`

  await sendEmail(to, `Skillbloom error: ${row.message.slice(0, 80)}`, html)
  return new Response('sent', { status: 200 })
})