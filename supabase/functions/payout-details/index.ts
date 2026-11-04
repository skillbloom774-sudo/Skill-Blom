import { createClient } from 'jsr:@supabase/supabase-js@2'
import { currentMode, secretFor } from '../_shared/paystack.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SHARE_ROLES = ['admin', 'developer', 'teacher']

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()

    // Who is calling? They must be signed in.
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

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    const isAdmin = profile?.role === 'admin'

    const { data: ownTeacher } = await admin
      .from('guest_teachers')
      .select('id')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (!isAdmin && !ownTeacher) {
      return respond({ error: 'Only staff can manage payout details.' }, 403)
    }

    // Payout accounts follow the same mode as payments: live or test
    const mode = currentMode()
    const paystackHeaders = { Authorization: `Bearer ${secretFor(mode)}` }

    if (body.action === 'banks') {
      const res = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=200', {
        headers: paystackHeaders,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.status) {
        return respond({ error: 'The bank list could not be loaded.' }, 502)
      }
      const banks = (json.data as { name: string; code: string }[])
        .map((b) => ({ name: b.name, code: b.code }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return respond({ banks })
    }

    if (body.action === 'list') {
      let query = admin
        .from('payout_recipients')
        .select('share_role, guest_teacher_id, label, bank_name, account_last4, account_name, updated_at')
        .eq('paystack_mode', mode)
      // Teachers only see their own row. The admin sees all of them.
      if (!isAdmin) query = query.eq('guest_teacher_id', ownTeacher!.id)
      const { data, error } = await query
      if (error) return respond({ error: error.message }, 500)
      return respond({ rows: data ?? [] })
    }

    if (body.action === 'save') {
      const role = String(body.share_role ?? '')
      if (!SHARE_ROLES.includes(role)) return respond({ error: 'Unknown payout role.' }, 400)

      let teacherId: string | null = null
      if (role === 'teacher') {
        teacherId = isAdmin ? String(body.guest_teacher_id ?? '') : ownTeacher!.id
        if (!teacherId) return respond({ error: 'Choose a teacher.' }, 400)
      } else if (!isAdmin) {
        return respond({ error: 'Only the admin can set this account.' }, 403)
      }

      const accountNumber = String(body.account_number ?? '').replace(/\D/g, '')
      if (!/^\d{10}$/.test(accountNumber)) {
        return respond({ error: 'The account number must be 10 digits.' }, 400)
      }
      const bankCode = String(body.bank_code ?? '')
      if (!bankCode) return respond({ error: 'Choose a bank.' }, 400)

      // 1. Check the account exists at that bank, and get the name registered to it
      const resolveRes = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`,
        { headers: paystackHeaders },
      )
      const resolved = await resolveRes.json().catch(() => null)
      if (!resolveRes.ok || !resolved?.status || !resolved.data?.account_name) {
        return respond({ error: 'We could not find that account. Check the number and the bank.' }, 400)
      }

      // 2. Register it with Paystack as a transfer recipient
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: { ...paystackHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'nuban',
          name: resolved.data.account_name,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: 'NGN',
        }),
      })
      const recipient = await recipientRes.json().catch(() => null)
      if (!recipientRes.ok || !recipient?.status || !recipient.data?.recipient_code) {
        console.error('Transfer recipient failed', recipient)
        return respond({ error: 'Paystack could not save this account. Try again.' }, 502)
      }

      const row = {
        share_role: role,
        guest_teacher_id: teacherId,
        label: String(body.label ?? role).trim().slice(0, 80) || role,
        paystack_mode: mode,
        recipient_code: recipient.data.recipient_code as string,
        bank_name: (recipient.data.details?.bank_name ?? '') as string,
        account_last4: accountNumber.slice(-4),
        account_name: (recipient.data.details?.account_name ?? resolved.data.account_name) as string,
        updated_at: new Date().toISOString(),
      }

      // Replace the existing account for this person in this mode, if there is one
      let existingQuery = admin
        .from('payout_recipients')
        .select('id')
        .eq('share_role', role)
        .eq('paystack_mode', mode)
      if (role === 'teacher') existingQuery = existingQuery.eq('guest_teacher_id', teacherId!)
      const { data: existing } = await existingQuery.maybeSingle()

      const { error: saveError } = existing
        ? await admin.from('payout_recipients').update(row).eq('id', existing.id)
        : await admin.from('payout_recipients').insert(row)
      if (saveError) {
        console.error('Payout save failed', saveError)
        return respond({ error: 'The account was checked, but could not be saved. Try again.' }, 500)
      }

      await admin.from('activity_log').insert({
        actor_id: caller.id,
        action: 'payout_details_saved',
        target_table: 'payout_recipients',
        details: { share_role: role, mode },
      })

      return respond({ ok: true, account_name: row.account_name, bank_name: row.bank_name })
    }

    return respond({ error: 'Unknown action.' }, 400)
  } catch (err) {
    console.error(err)
    return respond({ error: 'Something went wrong. Please try again.' }, 500)
  }
})