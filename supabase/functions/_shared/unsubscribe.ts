// Builds the unsubscribe code for one student. It can't be guessed without the secret.
export async function unsubscribeToken(userId: string): Promise<string> {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET') ?? ''
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}