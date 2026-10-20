import { supabase } from './supabase'

export type SessionOption = { id: string; title: string }

// Nigeria does not observe daylight saving, so a fixed offset keeps dates on Lagos time
const LAGOS_OFFSET = '+01:00'
const ONE_DAY_MS = 86_400_000

export async function fetchSessionOptions(): Promise<SessionOption[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, title')
    .order('starts_at', { ascending: false })
  if (error) throw error
  return (data as SessionOption[]) ?? []
}

// Start of the chosen day in Lagos time, or null if no date was picked
export function startOfDay(date: string): string | null {
  if (!date) return null
  return new Date(`${date}T00:00:00${LAGOS_OFFSET}`).toISOString()
}

// Start of the day after the chosen date, used as an exclusive upper bound
export function startOfNextDay(date: string): string | null {
  if (!date) return null
  return new Date(new Date(`${date}T00:00:00${LAGOS_OFFSET}`).getTime() + ONE_DAY_MS).toISOString()
}