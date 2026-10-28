import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'backups'
const KEEP = 8
const PAGE = 1000

const TABLES = [
  'sections',
  'guest_teachers',
  'sessions',
  'session_secrets',
  'materials',
  'material_files',
  'test_questions',
  'test_answer_keys',
  'submissions',
  'submission_files',
  'test_responses',
  'purchases',
  'payment_events',
  'refund_requests',
  'discount_codes',
  'discount_code_sessions',
  'certificates',
  'attendance',
  'recordings',
  'chat_threads',
  'chat_messages',
  'anonymous_senders',
  'message_reactions',
  'message_reports',
  'profiles',
  'session_views',
  'activity_log',
  'error_logs',
  'reminders_sent',
]

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Only the scheduler knows this secret
  if (req.headers.get('x-cron-secret') !== Deno.env.get('BACKUP_CRON_SECRET')) {
    return json({ error: 'unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Reads a whole table in pages, so large tables are not cut short
  async function exportTable(table: string): Promise<unknown[]> {
    const rows: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from(table).select('*').range(from, from + PAGE - 1)
      if (error) throw new Error(`${table}: ${error.message}`)
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    return rows
  }

  // Account list: names are kept in profiles, so this holds the login details
  async function exportAccounts() {
    const accounts: { id: string; email: string | undefined; created_at: string; email_confirmed_at: string | undefined }[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE })
      if (error) throw new Error(`accounts: ${error.message}`)
      const list = data?.users ?? []
      accounts.push(
        ...list.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at,
        })),
      )
      if (list.length < PAGE) break
    }
    return accounts
  }

  try {
    const now = new Date()
    const stamp = now.toISOString().slice(0, 10)
    const counts: Record<string, number> = {}
    const tables: Record<string, unknown[]> = {}

    for (const table of TABLES) {
      const rows = await exportTable(table)
      tables[table] = rows
      counts[table] = rows.length
    }

    const accounts = await exportAccounts()
    counts.accounts = accounts.length

    const snapshot = {
      created_at: now.toISOString(),
      counts,
      accounts,
      tables,
    }

    const fileName = `skillbloom-${stamp}.json`
    const body = new Blob([JSON.stringify(snapshot)], { type: 'application/json' })

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(fileName, body, { upsert: true, contentType: 'application/json' })
    if (uploadError) throw new Error(uploadError.message)

    // Keep only the most recent backups, newest first
    const { data: files, error: listError } = await admin.storage
      .from(BUCKET)
      .list('', { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
    if (listError) throw new Error(listError.message)

    const old = (files ?? [])
      .filter((f) => f.name.startsWith('skillbloom-'))
      .slice(KEEP)
      .map((f) => f.name)

    if (old.length > 0) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(old)
      if (removeError) throw new Error(removeError.message)
    }

    return json({ ok: true, file: fileName, counts, removed: old.length })
  } catch (err) {
    console.error('Backup failed', err)
    return json({ error: (err as Error).message }, 500)
  }
})