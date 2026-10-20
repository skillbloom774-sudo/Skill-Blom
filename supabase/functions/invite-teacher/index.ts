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
    const { email, guest_teacher_id, redirect_to } = await req.json()

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

    // Only admins can invite teachers
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return respond({ error: 'Only admins can invite teachers.' }, 403)
    }

    const { data: teacher } = await admin
      .from('guest_teachers')
      .select('id, name, user_id')
      .eq('id', guest_teacher_id)
      .maybeSingle()
    if (!teacher) return respond({ error: 'Teacher not found.' }, 404)
    if (teacher.user_id) return respond({ error: 'This teacher already has a login.' }, 400)

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: teacher.name },
      redirectTo: redirect_to,
    })
    if (inviteError || !invited.user) {
      return respond({ error: inviteError?.message ?? 'The invite could not be sent.' }, 400)
    }

    // Give the new account the teacher role and link it to the teacher profile
    await admin
      .from('profiles')
      .update({ role: 'guest_teacher', full_name: teacher.name })
      .eq('id', invited.user.id)

    await admin
      .from('guest_teachers')
      .update({ user_id: invited.user.id })
      .eq('id', teacher.id)

    await admin.from('activity_log').insert({
      actor_id: caller.id,
      action: 'invite_teacher',
      target_table: 'guest_teachers',
      target_id: teacher.id,
      details: { email },
    })

    return respond({ ok: true })
  } catch (err) {
    console.error(err)
    return respond({ error: 'Something went wrong. Please try again.' }, 500)
  }
})