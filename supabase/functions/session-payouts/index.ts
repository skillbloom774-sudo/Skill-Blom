import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'
import { currentMode, secretFor, type PaystackMode } from '../_shared/paystack.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Shares of the pool, in percent. Skillbloom keeps whatever is left, which is 30%.
const ROLES = ['admin', 'developer', 'teacher'] as const
type Role = (typeof ROLES)[number]
const SHARE_PERCENT: Record<Role, number> = { admin: 25, developer: 25, teacher: 20 }
const OTP_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5

type Transfer = {
  reference: string
  amount_kobo: number
  status: 'success' | 'pending' | 'failed' | 'otp_required'
  message: string
  account_name: string
  bank_name: string
  account_last4: string
  sent_at: string
}

type Recipient = {
  share_role: string
  guest_teacher_id: string | null
  recipient_code?: string
  account_name: string
  bank_name: string
  account_last4: string
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  return String(n).padStart(6, '0')
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

function mapStatus(s: string | undefined): Transfer['status'] {
  if (s === 'success') return 'success'
  if (s === 'otp') return 'otp_required'
  if (s === 'failed' || s === 'reversed') return 'failed'
  return 'pending'
}

// One bank account per role. The teacher's must belong to this session's teacher.
function pickRecipients<T extends Recipient>(rows: T[], teacherId: string | null) {
  const pick: Partial<Record<Role, T>> = {}
  for (const role of ROLES) {
    const row = rows.find(
      (r) => r.share_role === role && (role !== 'teacher' || r.guest_teacher_id === teacherId),
    )
    if (row) pick[role] = row
  }
  const missing = ROLES.filter((r) => !pick[r])
  return { pick, missing }
}

// Works out the net pool and each share, from paid students in this mode only
async function sessionBreakdown(admin: SupabaseClient, sessionId: string, mode: PaystackMode) {
  const { data: session } = await admin
    .from('sessions')
    .select('id, title, ends_at, status, guest_teacher_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (!session) return { error: 'Session not found.' }
  if (session.status === 'cancelled') return { error: 'Cancelled sessions are not paid out.' }
  if (new Date(session.ends_at) > new Date()) {
    return { error: 'Payouts can be prepared only after the session has ended.' }
  }
  if (!session.guest_teacher_id) return { error: 'Assign a teacher to this session first.' }

  const { data: purchases } = await admin
    .from('purchases')
    .select('id, paystack_reference, amount_paid_kobo, paystack_fee_kobo')
    .eq('session_id', sessionId)
    .eq('status', 'paid')
    .eq('paystack_mode', mode)
  if (!purchases || purchases.length === 0) {
    return { error: 'No paid students in this mode for this session.' }
  }

  // Net amount: what students paid, minus Paystack's fee on each payment
  let pool = 0
  for (const p of purchases) {
    let fee = p.paystack_fee_kobo as number | null
    if (fee === null || fee === undefined) {
      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(p.paystack_reference)}`,
        { headers: { Authorization: `Bearer ${secretFor(mode)}` } },
      )
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.status || typeof body.data?.fees !== 'number') {
        return { error: 'Paystack fees could not be checked. Try again in a minute.' }
      }
      fee = body.data.fees as number
      await admin.from('purchases').update({ paystack_fee_kobo: fee }).eq('id', p.id)
    }
    pool += p.amount_paid_kobo - fee
  }

  const { data: rows } = await admin
    .from('payout_recipients')
    .select('share_role, guest_teacher_id, recipient_code, account_name, bank_name, account_last4')
    .eq('paystack_mode', mode)
  const { missing } = pickRecipients((rows ?? []) as Recipient[], session.guest_teacher_id)
  if (missing.length) {
    return { error: `Bank details are missing for: ${missing.join(', ')}. Add them on the Payout details page.` }
  }

  const shares = {
    admin: Math.floor((pool * SHARE_PERCENT.admin) / 100),
    developer: Math.floor((pool * SHARE_PERCENT.developer) / 100),
    teacher: Math.floor((pool * SHARE_PERCENT.teacher) / 100),
  }
  const skillbloom = pool - shares.admin - shares.developer - shares.teacher

  return {
    data: {
      title: session.title as string,
      teacherId: session.guest_teacher_id as string,
      pool,
      paid_count: purchases.length,
      shares,
      skillbloom,
    },
  }
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

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

    const { data: profile } = await admin.from('profiles').select('role').eq('id', caller.id).maybeSingle()
    if (profile?.role !== 'admin') return respond({ error: 'Only admins can manage payouts.' }, 403)

    const mode = currentMode()
    const headers = { Authorization: `Bearer ${secretFor(mode)}`, 'Content-Type': 'application/json' }
    const sessionId = String(body.session_id ?? '')

    if (body.action === 'overview') {
      const [{ data: sessions }, { data: paid }, { data: payouts }, { data: recipients }] = await Promise.all([
        admin
          .from('sessions')
          .select('id, title, ends_at, guest_teacher_id, sections(name), guest_teachers(name)')
          .neq('status', 'cancelled')
          .lt('ends_at', new Date().toISOString())
          .order('ends_at', { ascending: false })
          .limit(60),
        admin
          .from('purchases')
          .select('session_id, amount_paid_kobo')
          .eq('status', 'paid')
          .eq('paystack_mode', mode),
        admin.from('session_payouts').select('*').eq('paystack_mode', mode),
        admin
          .from('payout_recipients')
          .select('share_role, guest_teacher_id, account_name, bank_name, account_last4')
          .eq('paystack_mode', mode),
      ])

      const gross = new Map<string, { count: number; amount: number }>()
      for (const p of paid ?? []) {
        const g = gross.get(p.session_id) ?? { count: 0, amount: 0 }
        g.count++
        g.amount += p.amount_paid_kobo
        gross.set(p.session_id, g)
      }
      const payoutBy = new Map((payouts ?? []).map((p) => [p.session_id, p]))

      const rows = (sessions ?? []).map((s) => {
        const g = gross.get(s.id)
        const { missing } = pickRecipients((recipients ?? []) as Recipient[], s.guest_teacher_id)
        return {
          id: s.id,
          title: s.title,
          ends_at: s.ends_at,
          section: (s.sections as unknown as { name: string } | null)?.name ?? '',
          teacher: (s.guest_teachers as unknown as { name: string } | null)?.name ?? null,
          paid_count: g?.count ?? 0,
          gross_kobo: g?.amount ?? 0,
          payout: payoutBy.get(s.id) ?? null,
          missing,
        }
      })
      return respond({ mode, sessions: rows.filter((r) => r.paid_count > 0 || r.payout) })
    }

    if (body.action === 'prepare') {
      const { data: existing } = await admin
        .from('session_payouts')
        .select('status')
        .eq('session_id', sessionId)
        .maybeSingle()
      if (existing && !['draft', 'otp_sent'].includes(existing.status)) {
        return respond({ error: 'This session has already been paid out.' }, 400)
      }

      const result = await sessionBreakdown(admin, sessionId, mode)
      if (result.error || !result.data) return respond({ error: result.error }, 400)
      const d = result.data
      const now = new Date().toISOString()

      const { error } = await admin.from('session_payouts').upsert(
        {
          session_id: sessionId,
          paystack_mode: mode,
          status: 'draft',
          pool_kobo: d.pool,
          skillbloom_kobo: d.skillbloom,
          admin_kobo: d.shares.admin,
          developer_kobo: d.shares.developer,
          teacher_kobo: d.shares.teacher,
          paid_count: d.paid_count,
          otp_hash: null,
          otp_expires_at: null,
          otp_attempts: 0,
          prepared_at: now,
          updated_at: now,
        },
        { onConflict: 'session_id' },
      )
      if (error) return respond({ error: error.message }, 500)

      await admin.from('activity_log').insert({
        actor_id: caller.id,
        action: 'payout_prepared',
        target_table: 'sessions',
        target_id: sessionId,
        details: { pool_kobo: d.pool, mode },
      })

      return respond({ ok: true })
    }

    if (body.action === 'request_otp') {
      const { data: row } = await admin.from('session_payouts').select('*').eq('session_id', sessionId).maybeSingle()
      if (!row) return respond({ error: 'Prepare the split first.' }, 400)
      if (row.paystack_mode !== mode) {
        return respond({ error: `This payout was prepared in ${row.paystack_mode} mode. Set PAYSTACK_MODE to ${row.paystack_mode} to send it.` }, 400)
      }
      if (!['draft', 'otp_sent', 'partial'].includes(row.status)) {
        return respond({ error: 'This payout cannot be sent again.' }, 400)
      }

      const { data: session } = await admin.from('sessions').select('guest_teacher_id').eq('id', sessionId).maybeSingle()
      const { data: rows } = await admin
        .from('payout_recipients')
        .select('share_role, guest_teacher_id, recipient_code, account_name, bank_name, account_last4')
        .eq('paystack_mode', mode)
      const { missing } = pickRecipients((rows ?? []) as Recipient[], session?.guest_teacher_id ?? null)
      if (missing.length) return respond({ error: `Bank details are missing for: ${missing.join(', ')}.` }, 400)

      const code = randomCode()
      const hash = await sha256(`${sessionId}:${code}:${serviceKey}`)
      const expires = new Date(Date.now() + OTP_MINUTES * 60_000).toISOString()

      await admin
        .from('session_payouts')
        .update({ status: 'otp_sent', otp_hash: hash, otp_expires_at: expires, otp_attempts: 0, updated_at: new Date().toISOString() })
        .eq('session_id', sessionId)

      const adminEmail = caller.email ?? ''
      if (!adminEmail) return respond({ error: 'Your account has no email address.' }, 400)

      const html = `
<div style="font-family: Inter, Arial, sans-serif; background:#FAF8F4; padding:32px; color:#1F2430;">
  <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border:1px solid #E4E7EC; padding:32px; line-height:1.6;">
    <p style="font-family: Georgia, serif; font-size:20px; color:#1B2A4A; margin:0 0 24px;">Skillbloom</p>
    <p>Someone asked to send the payout for a session. If that was you, use this code:</p>
    <p style="font-family:monospace; font-size:32px; letter-spacing:0.2em; color:#1B2A4A; margin:24px 0;"><strong>${code}</strong></p>
    <p>The code expires in ${OTP_MINUTES} minutes. If you did not ask for this, do not share the code, and check the Payouts page.</p>
  </div>
</div>`
      await sendEmail(adminEmail, 'Your Skillbloom payout code', html)

      return respond({ ok: true, sent_to: maskEmail(adminEmail) })
    }

    if (body.action === 'confirm') {
      const otp = String(body.otp ?? '').trim()
      const { data: row } = await admin.from('session_payouts').select('*').eq('session_id', sessionId).maybeSingle()
      if (!row || row.status !== 'otp_sent') return respond({ error: 'Ask for a new code first.' }, 400)
      if (row.paystack_mode !== mode) return respond({ error: `This payout belongs to ${row.paystack_mode} mode.` }, 400)
      if (!row.otp_expires_at || new Date(row.otp_expires_at) < new Date()) {
        return respond({ error: 'This code has expired. Ask for a new one.' }, 400)
      }
      if (row.otp_attempts >= OTP_MAX_ATTEMPTS) {
        return respond({ error: 'Too many wrong codes. Ask for a new one.' }, 400)
      }

      const hash = await sha256(`${sessionId}:${otp}:${serviceKey}`)
      if (hash !== row.otp_hash) {
        await admin.from('session_payouts').update({ otp_attempts: row.otp_attempts + 1 }).eq('session_id', sessionId)
        return respond({ error: 'That code is not right.' }, 400)
      }

      await admin
        .from('session_payouts')
        .update({ status: 'sending', otp_hash: null, otp_expires_at: null, otp_attempts: 0 })
        .eq('session_id', sessionId)

      const { data: session } = await admin.from('sessions').select('title, guest_teacher_id').eq('id', sessionId).maybeSingle()
      const { data: rows } = await admin
        .from('payout_recipients')
        .select('share_role, guest_teacher_id, recipient_code, account_name, bank_name, account_last4')
        .eq('paystack_mode', mode)
      const { pick } = pickRecipients((rows ?? []) as Recipient[], session?.guest_teacher_id ?? null)

      const amounts: Record<Role, number> = {
        admin: row.admin_kobo,
        developer: row.developer_kobo,
        teacher: row.teacher_kobo,
      }
      const transfers: Partial<Record<Role, Transfer>> = { ...(row.transfers ?? {}) }

      for (const role of ROLES) {
        if (amounts[role] <= 0) continue
        const before = transfers[role]
        // Never pay the same share twice
        if (before && (before.status === 'success' || before.status === 'pending')) continue

        const rec = pick[role]
        const sentAt = new Date().toISOString()
        if (!rec?.recipient_code) {
          transfers[role] = {
            reference: '', amount_kobo: amounts[role], status: 'failed', message: 'Bank details are missing.',
            account_name: '', bank_name: '', account_last4: '', sent_at: sentAt,
          }
          continue
        }

        const reference = `SBPO-${sessionId.slice(0, 8)}-${role}-${Date.now()}`
        const res = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            source: 'balance',
            amount: amounts[role],
            recipient: rec.recipient_code,
            reason: `Skillbloom session payout: ${session?.title ?? ''}`.slice(0, 100),
            reference,
          }),
        })
        const json = await res.json().catch(() => null)
        const accepted = res.ok && json?.status === true

        transfers[role] = {
          reference,
          amount_kobo: amounts[role],
          status: accepted ? mapStatus(json.data?.status) : 'failed',
          message: accepted
            ? String(json.data?.status ?? '')
            : String(json?.message ?? 'Paystack did not accept this transfer.'),
          account_name: rec.account_name,
          bank_name: rec.bank_name,
          account_last4: rec.account_last4,
          sent_at: sentAt,
        }
      }

      const needsAttention = ROLES.some(
        (role) => amounts[role] > 0 && (transfers[role]?.status === 'failed' || transfers[role]?.status === 'otp_required'),
      )
      const finalStatus = needsAttention ? 'partial' : 'sent'
      const now = new Date().toISOString()

      await admin
        .from('session_payouts')
        .update({ status: finalStatus, transfers, sent_at: now, updated_at: now })
        .eq('session_id', sessionId)

      await admin.from('activity_log').insert({
        actor_id: caller.id,
        action: 'payout_sent',
        target_table: 'sessions',
        target_id: sessionId,
        details: { status: finalStatus, mode },
      })

      return respond({ ok: true, status: finalStatus, transfers })
    }

    if (body.action === 'refresh') {
      const { data: row } = await admin.from('session_payouts').select('*').eq('session_id', sessionId).maybeSingle()
      if (!row) return respond({ error: 'No payout found for this session.' }, 400)

      const transfers: Partial<Record<Role, Transfer>> = { ...(row.transfers ?? {}) }
      for (const role of ROLES) {
        const t = transfers[role]
        if (!t || t.status !== 'pending' || !t.reference) continue
        const res = await fetch(`https://api.paystack.co/transfer/verify/${encodeURIComponent(t.reference)}`, { headers })
        const json = await res.json().catch(() => null)
        if (res.ok && json?.status === true) {
          transfers[role] = { ...t, status: mapStatus(json.data?.status), message: String(json.data?.status ?? t.message) }
        }
      }

      const needsAttention = ROLES.some(
        (role) => transfers[role]?.status === 'failed' || transfers[role]?.status === 'otp_required',
      )
      const finalStatus = needsAttention ? 'partial' : 'sent'
      await admin
        .from('session_payouts')
        .update({ status: finalStatus, transfers, updated_at: new Date().toISOString() })
        .eq('session_id', sessionId)

      return respond({ ok: true, status: finalStatus, transfers })
    }

    return respond({ error: 'Unknown action.' }, 400)
  } catch (err) {
    console.error(err)
    return respond({ error: 'Something went wrong. Please try again.' }, 500)
  }
})