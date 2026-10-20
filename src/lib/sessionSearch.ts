import { supabase } from './supabase'
import type { SessionListItem } from './sessions'

export const PAGE_SIZE = 12

export type SearchParams = {
  query: string
  section: string
  price: string
  page: number
}

export type SearchResult = {
  total: number
  rows: SessionListItem[]
}

type Row = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  price_kobo: number
  section_name: string
  section_slug: string
  teacher_name: string | null
  teacher_bio: string | null
  teacher_photo: string | null
}

function toListItem(r: Row): SessionListItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    price_kobo: r.price_kobo,
    sections: { name: r.section_name, slug: r.section_slug },
    guest_teachers: r.teacher_name
      ? { name: r.teacher_name, bio: r.teacher_bio, photo_path: r.teacher_photo }
      : null,
  }
}

export async function searchSessions(p: SearchParams): Promise<SearchResult> {
  const { data, error } = await supabase.rpc('search_sessions', {
    p_query: p.query || null,
    p_section: p.section || null,
    p_price_band: p.price || null,
    p_limit: PAGE_SIZE,
    p_offset: (p.page - 1) * PAGE_SIZE,
  })
  if (error) throw error

  const payload = data as { total: number; rows: Row[] }
  return { total: payload.total, rows: payload.rows.map(toListItem) }
}

export async function fetchSectionOptions(): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await supabase.from('sections').select('slug, name').order('name')
  if (error) throw error
  return (data as { slug: string; name: string }[]) ?? []
}