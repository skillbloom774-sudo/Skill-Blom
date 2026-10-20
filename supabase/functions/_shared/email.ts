export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch(Deno.env.get('MAIL_RELAY_URL')!, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      secret: Deno.env.get('MAIL_RELAY_SECRET'),
      to,
      subject,
      html,
    }),
  })

  const result = await res.json().catch(() => null)
  if (!res.ok || !result?.ok) {
    console.error('Mail relay error', result)
    throw new Error('Email could not be sent')
  }
  return result
}