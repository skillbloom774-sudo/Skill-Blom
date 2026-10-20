import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'
import { reminderEmail } from '../_shared/emails.ts'

type Claimed = {
  purchase_id: string
  student_id: string
  session_id: string
  title: string
  starts_at: string
  kind: '24h' | '15m'
}

function formatStart(iso: string) {
  return (
    new Intl.DateTimeFormat('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Africa/Lagos',
    }).format(new Date(iso)) + ' WAT'
  )
}

Deno.serve(async (req) => {
  // Only the scheduler knows this secret
  if (req.headers.get('x-cron-secret') !== Deno.env.get('REMINDER_CRON_SECRET')) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await admin.rpc('claim_reminders')
  if (error) {
    console.error('claim_reminders failed', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const due = (data as Claimed[]) ?? []
  let sent = 0
  let failed = 0

  for (const item of due) {
    try {
      const [{ data: profile }, { data: account }] = await Promise.all([
        admin.from('profiles').select('full_name').eq('id', item.student_id).maybeSingle(),
        admin.auth.admin.getUserById(item.student_id),
      ])

      const email = account?.user?.email
      if (!email) throw new Error('No email address on this account')

      const { subject, html } = reminderEmail({
        name: profile?.full_name ?? 'there',
        sessionTitle: item.title,
        when: formatStart(item.starts_at),
        kind: item.kind,
        roomUrl: `${Deno.env.get('SITE_URL')}/sessions/${item.session_id}/room`,
      })

      await sendEmail(email, subject, html)
      sent++
    } catch (err) {
      failed++
      console.error('Reminder failed', item, err)
      // Release the claim so the next run tries again
      await admin
        .from('reminders_sent')
        .delete()
        .match({ purchase_id: item.purchase_id, kind: item.kind })
    }
  }

  return new Response(JSON.stringify({ due: due.length, sent, failed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})