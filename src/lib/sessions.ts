import { supabase } from './supabase'

export type SessionListItem = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  price_kobo: number
  sections: { name: string; slug: string } | null
  guest_teachers: { name: string; bio: string | null; photo_path: string | null } | null
}

const SESSION_FIELDS =
  'id, title, description, starts_at, ends_at, price_kobo, sections!inner(name, slug), guest_teachers(name, bio, photo_path)'

export async function fetchUpcomingSessions(): Promise<SessionListItem[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_FIELDS)
    .eq('status', 'published')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  if (error) throw error
  return (data as unknown as SessionListItem[]) ?? []
}

export async function fetchSession(id: string): Promise<SessionListItem | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_FIELDS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return (data as unknown as SessionListItem) ?? null
}

export function formatNaira(kobo: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(kobo / 100)
}

export function formatSessionTime(iso: string) {
  const date = new Date(iso)
  return {
    day: new Intl.DateTimeFormat('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Africa/Lagos',
    }).format(date),
    time:
      new Intl.DateTimeFormat('en-NG', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Africa/Lagos',
      }).format(date) + ' WAT',
  }
}

export function teacherPhotoUrl(path: string | null) {
  if (!path) return null
  return supabase.storage.from('teacher-photos').getPublicUrl(path).data.publicUrl
}