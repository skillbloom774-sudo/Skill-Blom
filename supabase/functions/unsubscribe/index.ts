import { createClient } from 'jsr:@supabase/supabase-js@2'
import { unsubscribeToken } from '../_shared/unsubscribe.ts'

function page(title: string, text: string) {
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title></head>
<body style="margin:0; background:#FAF8F4; font-family: Inter, Arial, sans-serif; color:#1F2430;">
  <div style="max-width:520px; margin:60px auto; background:#FFFFFF; border:1px solid #E4E7EC; padding:32px; line-height:1.6;">
    <p style="font-family: Georgia, serif; font-size:20px; color:#1B2A4A; margin:0 0 20px;">Skillbloom</p>
    <h1 style="font-family: Georgia, serif; font-size:24px; color:#1B2A4A; margin:0 0 12px;">${title}</h1>
    <p>${text}</p>
  </div>
</body>
</html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('u') ?? ''
  const token = url.searchParams.get('t') ?? ''

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return page('This link is not valid', 'Please use the link from the email again, or contact us.')
  }

  const expected = await unsubscribeToken(id)
  if (token !== expected) {
    return page('This link is not valid', 'Please use the link from the email again, or contact us.')
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: getError } = await admin.auth.admin.getUserById(id)
  if (getError || !user) {
    return page('This link is not valid', 'Please use the link from the email again, or contact us.')
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { ...(user.user_metadata ?? {}), marketing_opt_in: false },
  })
  if (updateError) {
    return page('Something went wrong', 'We could not update your choice. Please try again, or email us.')
  }

  return page(
    'You have been unsubscribed',
    'You will no longer receive offers or discount codes from Skillbloom. You will still receive receipts, reminders and account emails.',
  )
})