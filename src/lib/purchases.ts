import { supabase } from './supabase'

export type Purchase = {
  id: string
  card_id: string
  paid_at: string | null
  access_ends_at: string | null
  sessions: {
    id: string
    title: string
    starts_at: string
    ends_at: string
    sections: { name: string } | null
    guest_teachers: { name: string } | null
  } | null
}

export type PurchaseState = 'upcoming' | 'live' | 'ended' | 'expired'

export const PURCHASE_SELECT = `
  id, card_id, paid_at, access_ends_at,
  sessions(id, title, starts_at, ends_at, sections(name), guest_teachers(name))
`

export async function fetchMyPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select(PURCHASE_SELECT)
    .eq('status', 'paid')

  if (error) throw error

  const rows = (data as unknown as Purchase[]) ?? []
  return rows.sort((a, b) =>
    (a.sessions?.starts_at ?? '').localeCompare(b.sessions?.starts_at ?? ''),
  )
}

export function getPurchaseState(p: Purchase, now = new Date()): PurchaseState {
  if (p.access_ends_at && new Date(p.access_ends_at) <= now) return 'expired'
  if (!p.sessions) return 'ended'

  const start = new Date(p.sessions.starts_at)
  const end = new Date(p.sessions.ends_at)

  if (now < start) return 'upcoming'
  if (now <= end) return 'live'
  return 'ended'
}