import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'
import { receiptEmailV2 } from '../_shared/templates.ts'
import { signedWithMode } from '../_shared/paystack.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  // The signature tells us which mode (live or test) sent this webhook. Anything unsigned is rejected.
  const rawBody = await req.text()
  const signedMode = await signedWithMode(rawBody, req.headers.get('x-paystack-signature'))
  if (!signedMode) return new Response('invalid signature', { status: 401 })

  const event = JSON.parse(rawBody)
  if (event.event !== 'charge.success') return new Response('ignored', { status: 200 })

  const reference: string = event.data.reference
  const paidAmount: number = event.data.amount

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: purchase } = await admin
    .from('purchases')
    .select('id, status, amount_paid_kobo, session_id, discount_code_id, student_id, card_id, paystack_mode')
    .eq('paystack_reference', reference)
    .maybeSingle()

  if (!purchase) return new Response('unknown reference', { status: 200 })

  // A test-mode webhook must never confirm a live purchase, and the reverse
  if (purchase.paystack_mode !== signedMode) {
    console.error('Mode mismatch', { reference, signedMode, purchaseMode: purchase.paystack_mode })
    return new Response('mode mismatch', { status: 400 })
  }

  // Paystack retries webhooks, so a repeat must do nothing
  if (purchase.status === 'paid') return new Response('already processed', { status: 200 })

  await admin.from('payment_events').upsert(
    { reference, event_type: event.event, payload: event },
    { onConflict: 'reference', ignoreDuplicates: true },
  )

  // Never grant access if the amount paid doesn't match what we expected
  if (paidAmount !== purchase.amount_paid_kobo) {
    console.error('Amount mismatch', { reference, paidAmount, expected: purchase.amount_paid_kobo })
    return new Response('amount mismatch', { status: 400 })
  }

  const { data: session } = await admin
    .from('sessions')
    .select('title, starts_at, access_ends_at, sections(name), guest_teachers(name)')
    .eq('id', purchase.session_id)
    .single()

  const { error: updateError } = await admin
    .from('purchases')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      access_ends_at: session?.access_ends_at,
    })
    .eq('id', purchase.id)
    .eq('status', 'pending')

  if (updateError) {
    console.error('Purchase update failed', updateError)
    return new Response('update failed', { status: 500 })
  }

  if (purchase.discount_code_id) {
    const { data: code } = await admin
      .from('discount_codes')
      .select('uses')
      .eq('id', purchase.discount_code_id)
      .single()
    if (code) {
      await admin
        .from('discount_codes')
        .update({ uses: code.uses + 1 })
        .eq('id', purchase.discount_code_id)
    }
  }

  // Send the receipt. Access is already granted, so a failed email is logged, not returned as an error.
  try {
    const [{ data: profile }, { data: account }] = await Promise.all([
      admin.from('profiles').select('full_name').eq('id', purchase.student_id).single(),
      admin.auth.admin.getUserById(purchase.student_id),
    ])

    const email = account?.user?.email
    if (email && session) {
      const info = session as unknown as {
        title: string
        starts_at: string
        access_ends_at: string
        sections: { name: string } | null
        guest_teachers: { name: string } | null
      }
      const siteUrl = Deno.env.get('SITE_URL') ?? 'https://skill-blom.vercel.app'
      const { subject, html } = receiptEmailV2({
        name: profile?.full_name ?? 'there',
        sessionTitle: info.title,
        section: info.sections?.name ?? '',
        teacher: info.guest_teachers?.name ?? 'your guest teacher',
        firstSession: new Date(info.starts_at).toLocaleString('en-NG', {
          timeZone: 'Africa/Lagos',
          dateStyle: 'long',
          timeStyle: 'short',
        }),
        amountNaira: `₦${(paidAmount / 100).toLocaleString('en-NG')}`,
        accessEnds: new Date(info.access_ends_at).toLocaleDateString('en-NG', {
          timeZone: 'Africa/Lagos',
          dateStyle: 'long',
        }),
        cardUrl: `${siteUrl}/cards/${purchase.card_id}`,
        siteUrl,
      })
      await sendEmail(email, subject, html)
    }
  } catch (err) {
    console.error('Receipt email failed', err)
  }

  return new Response('ok', { status: 200 })
})