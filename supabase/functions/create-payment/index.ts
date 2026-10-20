import { createClient } from 'jsr:@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { session_id, discount_code, callback_url } = await req.json()

    // Identify the signed-in account from their token
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return respond({ error: 'Please sign in before buying access.' }, 401)

    // The rest uses the service role so it can read prices and write purchases
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Guest teachers run sessions, they don't buy them
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const { data: teacherRecord } = await admin
      .from('guest_teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile?.role === 'guest_teacher' || teacherRecord) {
      return respond(
        { error: 'Guest teachers cannot buy sessions. Use your teaching area instead.' },
        403,
      )
    }

    const { data: session } = await admin
      .from('sessions')
      .select('id, title, price_kobo, status, access_ends_at, enrollment_limit')
      .eq('id', session_id)
      .maybeSingle()

    if (!session || session.status !== 'published') {
      return respond({ error: 'This session is not available.' }, 404)
    }
    if (new Date(session.access_ends_at) <= new Date()) {
      return respond({ error: 'Access for this session has closed.' }, 400)
    }

    const { data: alreadyPaid } = await admin
      .from('purchases')
      .select('id')
      .eq('student_id', user.id)
      .eq('session_id', session.id)
      .eq('status', 'paid')
      .maybeSingle()
    if (alreadyPaid) {
      return respond({ error: 'You already have access to this session.' }, 400)
    }

    if (session.enrollment_limit) {
      const { count } = await admin
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('status', 'paid')
      if ((count ?? 0) >= session.enrollment_limit) {
        return respond({ error: 'This session is full.' }, 400)
      }
    }

    // Apply a discount code if one was entered
    let amount: number = session.price_kobo
    let discountCodeId: string | null = null

    if (discount_code) {
      const code = String(discount_code).trim().toUpperCase()
      const { data: check } = await admin.rpc('validate_discount', {
        p_code: code,
        p_session: session.id,
      })
      if (!check?.valid) {
        return respond({ error: check?.reason ?? 'That discount code is not valid.' }, 400)
      }

      const { data: codeRow } = await admin
        .from('discount_codes')
        .select('id')
        .eq('code', code)
        .single()
      discountCodeId = codeRow?.id ?? null

      amount =
        check.kind === 'percent'
          ? Math.round((session.price_kobo * (100 - check.amount)) / 100)
          : Math.max(0, session.price_kobo - check.amount)
    }

    if (amount < 5000) {
      return respond({ error: 'The price after discount is below the ₦50 minimum.' }, 400)
    }

    const reference = `SB-${crypto.randomUUID()}`

    const { error: insertError } = await admin.from('purchases').insert({
      student_id: user.id,
      session_id: session.id,
      discount_code_id: discountCodeId,
      amount_paid_kobo: amount,
      paystack_reference: reference,
      status: 'pending',
    })
    if (insertError) {
      console.error('Purchase insert failed', insertError)
      return respond({ error: 'Could not start the payment. Please try again.' }, 500)
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount,
        currency: 'NGN',
        reference,
        callback_url,
        metadata: { session_id: session.id, student_id: user.id },
      }),
    })
    const paystack = await paystackRes.json()

    if (!paystackRes.ok || !paystack.status) {
      console.error('Paystack initialize failed', paystack)
      await admin.from('purchases').update({ status: 'failed' }).eq('paystack_reference', reference)
      return respond({ error: 'Payment could not be started. Please try again.' }, 502)
    }

    return respond({ authorization_url: paystack.data.authorization_url, reference })
  } catch (err) {
    console.error(err)
    return respond({ error: 'Something went wrong. Please try again.' }, 500)
  }
})