import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_RECIPIENTS = 50

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function wrap(name: string, message: string) {
  const body = esc(message).replace(/\r?\n/g, '<br/>')
  return `
<div style="font-family: Inter, Arial, sans-serif; background:#FAF8F4; padding:32px; color:#1F2430;">
  <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border:1px solid #E4E7EC; padding:32px;">
    <p style="font-family: Georgia, serif; font-size:20px; color:#1B2A4A; margin:0 0 24px;">Skillbloom</p>
    <p>Hi ${esc(name)},</p>
    <div style="line-height:1.6;">${body}</div>
    <p style="font-size:12px; color:#667085; margin-top:32px;">You're receiving this because you bought access to a Skillbloom session.</p>
  </div>
</div>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { session_id, subject, message, purchase_ids } = await req.json()

    // Who is sending? They must be signed in.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) return respond({ error: 'Please sign in.' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    if (callerProfile?.role !== 'admin') {
      return respond({ error: 'Only admins can email students.' }, 403)
    }

    const cleanSubject = String(subject ?? '').trim().slice(0, 150)
    const cleanMessage = String(message ?? '').trim().slice(0, 5000)
    if (!cleanSubject || !cleanMessage) {
      return respond({ error: 'Add a subject and a message.' }, 400)
    }

    const ids: string[] = Array.isArray(purchase_ids) ? purchase_ids : []
    if (ids.length > MAX_RECIPIENTS) {
      return respond({ error: `Email up to ${MAX_RECIPIENTS} students at a time.` }, 400)
    }

    // Only paying students for this session. If students were ticked, only those.
    let query = admin
      .from('purchases')
      .select('id, student_id, profiles(full_name)')
      .eq('session_id', session_id)
      .eq('status', 'paid')
    if (ids.length > 0) query = query.in('id', ids)

    const { data: recipients, error: queryError } = await query
    if (queryError) return respond({ error: queryError.message }, 500)
    if (!recipients || recipients.length === 0) {
      return respond({ error: 'No paying students to email.' }, 400)
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return respond({ error: `Email up to ${MAX_RECIPIENTS} students at a time. Tick fewer students.` }, 400)
    }

    let sent = 0
    let failed = 0

    for (const r of recipients) {
      try {
        const { data: account } = await admin.auth.admin.getUserById(r.student_id)
        const email = account?.user?.email
        if (!email) throw new Error('No email address on this account')

        const profile = (r as unknown as { profiles: { full_name: string | null } | null }).profiles
        const name = profile?.full_name?.trim() || 'there'

        await sendEmail(email, cleanSubject, wrap(name, cleanMessage))
        sent++
      } catch (err) {
        failed++
        console.error('Session email failed for purchase', r.id, err)
      }
    }

    await admin.from('activity_log').insert({
      actor_id: caller.id,
      action: 'session_email',
      target_table: 'sessions',
      target_id: session_id,
      details: { sent, failed, subject: cleanSubject },
    })

    return respond({ sent, failed })
  } catch (err) {
    console.error(err)
    return respond({ error: 'Something went wrong. Please try again.' }, 500)
  }
})