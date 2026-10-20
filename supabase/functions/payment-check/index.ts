import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'
import { receiptEmail } from '../_shared/emails.ts'

// Payments still pending after this many minutes are checked with Paystack
const CHECK_AFTER_MINUTES = 10
const BATCH_SIZE = 100

type Pending = {
  id: string
  paystack_reference: string
  amount_paid_kobo: number
  student_id: string
  session_id: string
  discount_code_id: string | null
  card_id: string
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Same steps as the webhook: grant access, count the discount, send the receipt
async function grantAccess(admin: SupabaseClient, p: Pending): Promise<boolean> {
  const { data: session } = await admin
    .from('sessions')
    .select('title, access_ends_at')
    .eq('id', p.session_id)
    .single()
  if (!session) return false

  const { data: updated, error } = await admin
    .from('purchases')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      access_ends_at: session.access_ends_at,
    })
    .eq('id', p.id)
    .eq('status', 'pending')
    .select('id')

  if (error) throw error
  // Already handled, for example by the webhook
  if (!updated?.length) return false

  if (p.discount_code_id) {
    const { data: code } = await admin
      .from('discount_codes')
      .select('uses')
      .eq('id', p.discount_code_id)
      .single()
    if (code) {
      await admin.from('discount_codes').update({ uses: code.uses + 1 }).eq('id', p.discount_code_id)
    }
  }

  try {
    const [{ data: profile }, { data: account }] = await Promise.all([
      admin.from('profiles').select('full_name').eq('id', p.student_id).maybeSingle(),
      admin.auth.admin.getUserById(p.student_id),
    ])
    const email = account?.user?.email
    if (email) {
      const accessEnds = new Date(session.access_ends_at).toLocaleDateString('en-NG', {
        timeZone: 'Africa/Lagos',
        dateStyle: 'long',
      })
      const { subject, html } = receiptEmail({
        name: profile?.full_name ?? 'there',
        sessionTitle: session.title,
        amountNaira: `₦${(p.amount_paid_kobo / 100).toLocaleString('en-NG')}`,
        cardId: p.card_id,
        accessEnds,
        cardUrl: `${Deno.env.get('SITE_URL')}/cards/${p.card_id}`,
      })
      await sendEmail(email, subject, html)
    }
  } catch (err) {
    console.error('Receipt email failed', err)
  }

  return true
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('REMINDER_CRON_SECRET')) {
    return json({ error: 'unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const cutoff = new Date(Date.now() - CHECK_AFTER_MINUTES * 60_000).toISOString()
  const { data: pending, error } = await admin
    .from('purchases')
    .select('id, paystack_reference, amount_paid_kobo, student_id, session_id, discount_code_id, card_id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(BATCH_SIZE)

  if (error) return json({ error: error.message }, 500)

  const counts = { checked: 0, fixed: 0, marked_failed: 0, still_processing: 0, errors: 0 }

  for (const p of (pending as Pending[]) ?? []) {
    counts.checked++
    try {
      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(p.paystack_reference)}`,
        { headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` } },
      )
      const body = await res.json().catch(() => null)
      const tx = body?.data

      if (!res.ok || !body?.status || !tx) {
        counts.errors++
        continue
      }

      if (tx.status === 'success') {
        if (tx.amount !== p.amount_paid_kobo) {
          console.error('Amount mismatch', { reference: p.paystack_reference, paid: tx.amount })
          counts.errors++
          continue
        }
        if (await grantAccess(admin, p)) counts.fixed++
      } else if (tx.status === 'failed' || tx.status === 'abandoned') {
        await admin
          .from('purchases')
          .update({ status: 'failed' })
          .eq('id', p.id)
          .eq('status', 'pending')
        counts.marked_failed++
      } else {
        // Still being processed. The next run checks again.
        counts.still_processing++
      }
    } catch (err) {
      counts.errors++
      console.error('Payment check failed', p.paystack_reference, err)
    }
  }

  return json(counts)
})