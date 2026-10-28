import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'
import { secretFor } from '../_shared/paystack.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function refundHtml(name: string, title: string, amount: string) {
  return `
<div style="font-family: Inter, Arial, sans-serif; background:#FAF8F4; padding:32px; color:#1F2430;">
  <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border:1px solid #E4E7EC; padding:32px;">
    <p style="font-family: Georgia, serif; font-size:20px; color:#1B2A4A; margin:0 0 24px;">Skillbloom</p>
    <h1 style="font-family: Georgia, serif; font-size:24px; color:#1B2A4A; margin:0 0 16px;">Your refund is on its way</h1>
    <p>Hi ${esc(name)}, we have refunded <strong>${amount}</strong> for <strong>${esc(title)}</strong>.</p>
    <p>Refunds usually reach your bank or card within a few working days, depending on your bank. Your access to this session has ended.</p>
    <p style="font-size:12px; color:#667085; margin-top:32px;">You're receiving this because you have a Skillbloom account.</p>
  </div>
</div>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { purchase_id, reason } = await req.json()

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

    // Only admins can issue refunds
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return respond({ error: 'Only admins can issue refunds.' }, 403)
    }

    const { data: purchase } = await admin
      .from('purchases')
      .select('id, status, paystack_reference, amount_paid_kobo, student_id, paystack_mode, sessions(title)')
      .eq('id', purchase_id)
      .maybeSingle()

    if (!purchase) return respond({ error: 'Purchase not found.' }, 404)
    if (purchase.status !== 'paid') {
      return respond({ error: 'Only paid purchases can be refunded.' }, 400)
    }

    // Send the money back through Paystack first, using the key of the mode the payment was made in.
    // Records change only after Paystack accepts it.
    const refundRes = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretFor(purchase.paystack_mode)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: purchase.paystack_reference,
        merchant_note: String(reason ?? 'Refund').slice(0, 200),
      }),
    })
    const refund = await refundRes.json().catch(() => null)

    if (!refundRes.ok || !refund?.status) {
      console.error('Paystack refund failed', refund)
      return respond({ error: refund?.message ?? 'Paystack could not process this refund.' }, 502)
    }

    const now = new Date().toISOString()

    const { error: updateError } = await admin
      .from('purchases')
      .update({ status: 'refunded', refunded_at: now, access_ends_at: now })
      .eq('id', purchase.id)
      .eq('status', 'paid')

    if (updateError) {
      console.error('Purchase update failed after refund', updateError)
      return respond(
        { error: 'The refund was sent, but the record did not update. Check this purchase in Paystack and Supabase.' },
        500,
      )
    }

    await admin
      .from('refund_requests')
      .update({ status: 'approved', decided_at: now })
      .eq('purchase_id', purchase.id)
      .eq('status', 'pending')

    await admin.from('activity_log').insert({
      actor_id: caller.id,
      action: 'refund_purchase',
      target_table: 'purchases',
      target_id: purchase.id,
      details: {
        reference: purchase.paystack_reference,
        mode: purchase.paystack_mode,
        amount_kobo: purchase.amount_paid_kobo,
        reason: reason ?? null,
      },
    })

    // Tell the student. A failed email doesn't undo the refund.
    try {
      const [{ data: profile }, { data: account }] = await Promise.all([
        admin.from('profiles').select('full_name').eq('id', purchase.student_id).maybeSingle(),
        admin.auth.admin.getUserById(purchase.student_id),
      ])
      const email = account?.user?.email
      if (email) {
        const title = (purchase.sessions as unknown as { title: string } | null)?.title ?? 'your session'
        const amount = `₦${(purchase.amount_paid_kobo / 100).toLocaleString('en-NG')}`
        await sendEmail(
          email,
          `Your refund for ${title}`,
          refundHtml(profile?.full_name ?? 'there', title, amount),
        )
      }
    } catch (err) {
      console.error('Refund email failed', err)
    }

    return respond({ ok: true })
  } catch (err) {
    console.error(err)
    return respond({ error: 'Something went wrong. Please try again.' }, 500)
  }
})