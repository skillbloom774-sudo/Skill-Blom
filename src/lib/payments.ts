import { supabase } from './supabase'

// Calls a Supabase Edge Function and returns a readable error message if it fails
export async function callFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const payload = (await (error as { context?: Response }).context?.json().catch(() => null)) as
      | { error?: string }
      | null
      | undefined
    return { data: null, error: payload?.error ?? 'Something went wrong. Please try again.' }
  }
  return { data: data as T, error: null }
}

export function refundPurchase(purchaseId: string, reason: string) {
  return callFunction<{ ok: boolean }>('refund-purchase', { purchase_id: purchaseId, reason })
}