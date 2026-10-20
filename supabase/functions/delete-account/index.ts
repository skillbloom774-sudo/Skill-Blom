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

// Splits a list into groups so large deletes stay within limits
function chunks<T>(items: T[], size = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Who is asking? They must be signed in.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return respond({ error: 'Please sign in.' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Only plain student accounts can delete themselves
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const { data: teacher } = await admin
      .from('guest_teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile?.role !== 'student' || teacher) {
      return respond(
        { error: 'Admin and teacher accounts are closed by the Skillbloom team. Please contact us.' },
        403,
      )
    }

    // 1. Uploaded files the student submitted
    const { data: subs } = await admin
      .from('submissions')
      .select('id, file_path')
      .eq('student_id', user.id)
    const submissionIds = (subs ?? []).map((s) => s.id)

    const filePaths: string[] = (subs ?? [])
      .map((s) => s.file_path)
      .filter((p): p is string => !!p)

    if (submissionIds.length > 0) {
      const { data: subFiles } = await admin
        .from('submission_files')
        .select('file_path')
        .in('submission_id', submissionIds)
      const { data: answerFiles } = await admin
        .from('test_responses')
        .select('file_path')
        .in('submission_id', submissionIds)

      filePaths.push(...(subFiles ?? []).map((f) => f.file_path))
      filePaths.push(
        ...(answerFiles ?? []).map((r) => r.file_path).filter((p): p is string => !!p),
      )
    }

    for (const group of chunks(filePaths)) {
      await admin.storage.from('submissions').remove(group)
    }

    // 2. Chat messages: their own, and anonymous ones they sent
    const { data: anonymous } = await admin
      .from('anonymous_senders')
      .select('message_id')
      .eq('sender_id', user.id)
    const { data: own } = await admin
      .from('chat_messages')
      .select('id')
      .eq('sender_id', user.id)

    const messageIds = [
      ...(anonymous ?? []).map((a) => a.message_id),
      ...(own ?? []).map((m) => m.id),
    ]
    for (const group of chunks(messageIds)) {
      await admin.from('chat_messages').delete().in('id', group)
    }

    // 3. Private chats with their teacher, and their submissions
    await admin.from('chat_threads').delete().eq('student_id', user.id)
    await admin.from('submissions').delete().eq('student_id', user.id)

    // 4. Record the deletion without any personal details
    await admin.from('activity_log').insert({
      actor_id: null,
      action: 'account_deleted',
      target_table: 'profiles',
      target_id: user.id,
    })

    // 5. Delete the login. Their profile goes with it. Payments stay, with the student link removed.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('Account deletion failed', deleteError)
      return respond({ error: 'Your account could not be deleted. Please try again.' }, 500)
    }

    return respond({ ok: true })
  } catch (err) {
    console.error(err)
    return respond({ error: 'Something went wrong. Please try again.' }, 500)
  }
})