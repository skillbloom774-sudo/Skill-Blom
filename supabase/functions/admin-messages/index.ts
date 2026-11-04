import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'
import { unsubscribeToken } from '../_shared/unsubscribe.ts'

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

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function emailHtml(bodyHtml: string, footerHtml: string) {
  return `
<div style="font-family: Inter, Arial, sans-serif; background:#FAF8F4; padding:32px; color:#1F2430;">
  <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border:1px solid #E4E7EC; padding:32px; line-height:1.6;">
    <p style="font-family: Georgia, serif; font-size:20px; color:#1B2A4A; margin:0 0 24px;">Skillbloom</p>
    ${bodyHtml}
    <p style="font-size:12px; color:#667085; margin-top:32px;">${footerHtml}</p>
  </div>
</div>`
}

// Reads every account once, with its email and promotional choice
async function allAccounts(admin: SupabaseClient) {
  const map = new Map<string, { email: string | undefined; optIn: boolean }>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    const list = data?.users ?? []
    for (const u of list) {
      map.set(u.id, {
        email: u.email,
        optIn: u.user_metadata?.marketing_opt_in === true,
      })
    }
    if (list.length < 1000) break
  }
  return map
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()

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
      return respond({ error: 'Only admins can send messages.' }, 403)
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://skill-blom.vercel.app'

    if (body.action === 'list') {
      const [{ data: profiles }, { data: paid }, accounts] = await Promise.all([
        admin.from('profiles').select('id, full_name, phone').eq('role', 'student'),
        admin.from('purchases').select('student_id').eq('status', 'paid'),
        allAccounts(admin),
      ])

      const counts = new Map<string, number>()
      for (const p of paid ?? []) {
        counts.set(p.student_id, (counts.get(p.student_id) ?? 0) + 1)
      }

      const students = (profiles ?? [])
        .map((p) => {
          const acc = accounts.get(p.id)
          return {
            id: p.id,
            name: p.full_name?.trim() || 'Student',
            phone: p.phone ?? '',
            email: acc?.email ?? '',
            opted_in: acc?.optIn ?? false,
            paid_sessions: counts.get(p.id) ?? 0,
          }
        })
        .filter((s) => s.email)
        .sort((a, b) => a.name.localeCompare(b.name))

      return respond({ students })
    }

    if (body.action === 'codes') {
      const { data, error } = await admin
        .from('discount_codes')
        .select('code, kind, amount, expires_at, active, max_uses, uses')
        .eq('active', true)
      if (error) return respond({ error: error.message }, 500)
      return respond({ codes: data ?? [] })
    }

    if (body.action === 'send') {
      const mode = body.mode === 'discount' ? 'discount' : 'message'
      const ids: string[] = Array.isArray(body.recipient_ids) ? body.recipient_ids : []
      const subject = String(body.subject ?? '').trim().slice(0, 150)
      const message = String(body.message ?? '').trim().slice(0, 5000)

      if (ids.length === 0) return respond({ error: 'Choose at least one student.' }, 400)
      if (ids.length > MAX_RECIPIENTS) {
        return respond({ error: `Send to up to ${MAX_RECIPIENTS} students at a time.` }, 400)
      }
      if (!subject || !message) return respond({ error: 'Add a subject and a message.' }, 400)

      let codeRow: { code: string; kind: string; amount: number; expires_at: string | null } | null = null
      if (mode === 'discount') {
        const code = String(body.code ?? '').trim().toUpperCase()
        if (!code) return respond({ error: 'Choose a discount code.' }, 400)

        const { data } = await admin
          .from('discount_codes')
          .select('code, kind, amount, expires_at, active')
          .eq('code', code)
          .maybeSingle()
        if (!data || !data.active) return respond({ error: 'That code is not active.' }, 400)
        if (data.expires_at && new Date(data.expires_at) <= new Date()) {
          return respond({ error: 'That code has expired.' }, 400)
        }
        codeRow = data
      }

      const [{ data: profiles }, accounts] = await Promise.all([
        admin.from('profiles').select('id, full_name, role').in('id', ids),
        allAccounts(admin),
      ])

      const offer = codeRow
        ? codeRow.kind === 'percent'
          ? `${codeRow.amount}% off`
          : `₦${(codeRow.amount / 100).toLocaleString('en-NG')} off`
        : ''

      let sent = 0
      let failed = 0
      let skipped = 0

      for (const id of ids) {
        const prof = profiles?.find((p) => p.id === id)
        const acc = accounts.get(id)

        // Only students, with an email address, and for codes only those who opted in
        if (!prof || prof.role !== 'student' || !acc?.email) { skipped++; continue }
        if (mode === 'discount' && !acc.optIn) { skipped++; continue }

        const name = prof.full_name?.trim() || 'there'
        const codeBlock = codeRow
          ? `<div style="margin:24px 0; padding:16px; border:1px dashed #1B2A4A; text-align:center;">
               <p style="margin:0 0 6px; font-size:12px; color:#667085; letter-spacing:0.1em;">YOUR CODE</p>
               <p style="margin:0; font-family:monospace; font-size:22px; letter-spacing:0.15em; color:#1B2A4A;"><strong>${esc(codeRow.code)}</strong></p>
               <p style="margin:6px 0 0; font-size:14px;">${esc(offer)} on eligible sessions, at checkout.</p>
             </div>`
          : ''

        let footer = `You're receiving this because you have a Skillbloom account.`
        if (mode === 'discount') {
          const token = await unsubscribeToken(id)
          const link = `${siteUrl}/unsubscribe?u=${id}&t=${token}`
          footer = `You're receiving this because you chose to hear about offers from Skillbloom. <a href="${esc(link)}" style="color:#667085;">Unsubscribe</a> at any time.`
        }

        const html = emailHtml(`<p>Hello ${esc(name)},</p>${paragraphs(message)}${codeBlock}`, footer)

        try {
          await sendEmail(acc.email, subject, html)
          sent++
        } catch (err) {
          console.error('Admin message failed', err)
          failed++
        }
      }

      await admin.from('activity_log').insert({
        actor_id: caller.id,
        action: 'admin_message',
        target_table: 'profiles',
        details: { mode, sent, failed, skipped, code: codeRow?.code ?? null },
      })

      return respond({ sent, failed, skipped })
    }

    return respond({ error: 'Unknown action.' }, 400)
  } catch (err) {
    console.error(err)
    return respond({ error: 'Something went wrong. Please try again.' }, 500)
  }
})