export type PaystackMode = 'live' | 'test'

// The mode new payments use. Set with: npx supabase secrets set PAYSTACK_MODE=live|test
export function currentMode(): PaystackMode {
  return Deno.env.get('PAYSTACK_MODE') === 'test' ? 'test' : 'live'
}

// The secret key for a given mode. Fails loudly if it was never set.
export function secretFor(mode: PaystackMode): string {
  const key = mode === 'test'
    ? Deno.env.get('PAYSTACK_TEST_SECRET_KEY')
    : Deno.env.get('PAYSTACK_LIVE_SECRET_KEY')
  if (!key) throw new Error(`Paystack ${mode} key is not set`)
  return key
}

async function hmacSha512(key: string, body: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(body))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Returns the mode whose key signed this webhook, or null if neither matches.
export async function signedWithMode(body: string, signature: string | null): Promise<PaystackMode | null> {
  if (!signature) return null
  for (const mode of ['live', 'test'] as PaystackMode[]) {
    const key = Deno.env.get(mode === 'test' ? 'PAYSTACK_TEST_SECRET_KEY' : 'PAYSTACK_LIVE_SECRET_KEY')
    if (!key) continue
    if ((await hmacSha512(key, body)) === signature) return mode
  }
  return null
}