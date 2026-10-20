import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { teacherPhotoUrl } from '../../lib/sessions'

const PAGE_SIZE = 20
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

type TeacherState = 'linked' | 'unlinked' | 'no_consent'

type Teacher = {
  id: string
  name: string
  bio: string | null
  photo_path: string | null
  consent_given: boolean
  user_id: string | null
  state: TeacherState
  session_count: number
}

type StateFilter = 'all' | TeacherState
const FILTERS: StateFilter[] = ['all', 'linked', 'unlinked', 'no_consent']
const FILTER_LABEL: Record<StateFilter, string> = {
  all: 'All',
  linked: 'Login active',
  unlinked: 'No login yet',
  no_consent: 'No consent',
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm transition ${
    active
      ? 'bg-brand-primary text-white'
      : 'border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text'
  }`
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

async function uploadPhoto(file: File): Promise<{ path: string | null; error: string | null }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('teacher-photos')
    .upload(path, file, { contentType: file.type })
  return error ? { path: null, error: error.message } : { path, error: null }
}

export default function AdminTeachers() {
  const [result, setResult] = useState<{ key: string; rows: Teacher[]; total: number } | null>(null)

  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [filter, setFilter] = useState<StateFilter>('all')
  const [page, setPage] = useState(1)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Add form
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [consent, setConsent] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editConsent, setEditConsent] = useState(false)
  const [editFile, setEditFile] = useState<File | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Invite
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({})
  const [invitingId, setInvitingId] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const key = `${query}|${filter}|${page}|${reloadKey}`

    supabase
      .rpc('search_admin_teachers', {
        p_query: query || null,
        p_status: filter === 'all' ? null : filter,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      })
      .then(({ data, error }) => {
        if (ignore) return
        if (error) {
          setError(error.message)
          return
        }
        const payload = data as { total: number; rows: Teacher[] }
        setError(null)
        setResult({ key, rows: payload.rows, total: payload.total })
      })

    return () => {
      ignore = true
    }
  }, [query, filter, page, reloadKey])

  const currentKey = `${query}|${filter}|${page}|${reloadKey}`
  const loading = result?.key !== currentKey
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  function reload() {
    setReloadKey((k) => k + 1)
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    setQuery(draftQuery.trim())
    setPage(1)
  }

  function clearSearch() {
    setDraftQuery('')
    setQuery('')
    setPage(1)
  }

  function chooseFilter(f: StateFilter) {
    setFilter(f)
    setPage(1)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (!consent) {
      setError('Get written consent from the teacher before publishing their name and photo.')
      return
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      setError('Photo must be under 2 MB.')
      return
    }

    setBusy(true)

    let photo_path: string | null = null
    if (file) {
      const { path, error: uploadError } = await uploadPhoto(file)
      if (uploadError || !path) {
        setBusy(false)
        setError(uploadError ?? 'Photo upload failed.')
        return
      }
      photo_path = path
    }

    const { error } = await supabase.from('guest_teachers').insert({
      name: name.trim(),
      bio: bio.trim() || null,
      photo_path,
      consent_given: true,
    })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }

    setName('')
    setBio('')
    setConsent(false)
    setFile(null)
    setNotice('Teacher added.')
    reload()
  }

  function startEdit(t: Teacher) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditBio(t.bio ?? '')
    setEditConsent(t.consent_given)
    setEditFile(null)
    setError(null)
    setNotice(null)
  }

  async function saveEdit(t: Teacher) {
    setError(null)
    setNotice(null)

    if (!editName.trim()) {
      setError("Enter the teacher's name.")
      return
    }
    if (!editConsent) {
      setError('Written consent is needed to keep this teacher published. Tick the box to save.')
      return
    }
    if (editFile && editFile.size > MAX_PHOTO_BYTES) {
      setError('Photo must be under 2 MB.')
      return
    }

    setSavingId(t.id)

    let photo_path = t.photo_path
    let newPath: string | null = null

    if (editFile) {
      const { path, error: uploadError } = await uploadPhoto(editFile)
      if (uploadError || !path) {
        setSavingId(null)
        setError(uploadError ?? 'Photo upload failed.')
        return
      }
      photo_path = path
      newPath = path
    }

    const { error } = await supabase
      .from('guest_teachers')
      .update({
        name: editName.trim(),
        bio: editBio.trim() || null,
        photo_path,
        consent_given: editConsent,
      })
      .eq('id', t.id)

    setSavingId(null)

    if (error) {
      if (newPath) await supabase.storage.from('teacher-photos').remove([newPath])
      setError(error.message)
      return
    }

    if (editFile && t.photo_path) {
      await supabase.storage.from('teacher-photos').remove([t.photo_path])
    }

    setEditingId(null)
    setEditFile(null)
    setNotice('Teacher updated.')
    reload()
  }

  async function sendInvite(t: Teacher) {
    const email = (inviteEmails[t.id] ?? '').trim().toLowerCase()
    if (!email) {
      setError("Enter the teacher's email first.")
      return
    }

    setInvitingId(t.id)
    setError(null)
    setNotice(null)

    const { error } = await supabase.functions.invoke('invite-teacher', {
      body: {
        email,
        guest_teacher_id: t.id,
        redirect_to: `${window.location.origin}/set-password`,
      },
    })
    setInvitingId(null)

    if (error) {
      const body = await (error as { context?: Response }).context?.json().catch(() => null)
      setError(body?.error ?? 'The invite could not be sent.')
      return
    }

    setNotice(`Invite sent to ${email}. Ask the teacher to check their inbox.`)
    setInviteEmails((prev) => ({ ...prev, [t.id]: '' }))
    reload()
  }

  async function handleDelete(t: Teacher) {
    const warning =
      t.session_count > 0
        ? `${t.name} is assigned to ${t.session_count} session(s). They will be left without a teacher. Continue?`
        : `Delete ${t.name}?`
    if (!confirm(warning)) return

    setError(null)
    setNotice(null)

    const { error } = await supabase.from('guest_teachers').delete().eq('id', t.id)
    if (error) {
      setError(error.message)
      return
    }

    if (t.photo_path) {
      await supabase.storage.from('teacher-photos').remove([t.photo_path])
    }

    setNotice('Teacher deleted.')
    reload()
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-4xl">Guest teachers</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Guest teachers appear on the sessions they lead. Each one needs written consent before their name and
        photo are shown to students.
      </p>

      {/* Add a teacher */}
      <form onSubmit={handleCreate} className="card mt-10 grid gap-5 sm:max-w-xl">
        <h2 className="text-xl">Add a teacher</h2>
        <Field id="t-name" label="Full name">
          <input id="t-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field id="t-bio" label="Short bio">
          <textarea
            id="t-bio"
            className="field min-h-24"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Two or three lines about their work"
          />
        </Field>
        <Field id="t-photo" label="Photo (square, under 2 MB)">
          <input
            id="t-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-brand-muted"
          />
        </Field>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-brand-muted">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 accent-brand-primary"
          />
          <span>The teacher has agreed in writing to publish their name, photo, and bio.</span>
        </label>
        <div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving' : 'Add teacher'}
          </button>
        </div>
      </form>

      {error && <p className="mt-6 text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-6 text-sm text-brand-success">{notice}</p>}

      {/* Teacher list */}
      <div className="mt-16">
        <h2 className="text-2xl">All teachers</h2>

        <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="field sm:max-w-md"
            placeholder="Search by name"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            aria-label="Search teachers"
          />
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Search</button>
            {query && (
              <button type="button" onClick={clearSearch} className="btn-ghost">Clear</button>
            )}
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => chooseFilter(f)} className={chipClass(filter === f)}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        {result === null && !error && <p className="mt-8 text-brand-muted">Loading teachers</p>}
        {result !== null && !loading && total === 0 && (
          <p className="mt-8 text-brand-muted">
            {query || filter !== 'all' ? 'No teachers match these filters.' : 'No guest teachers yet.'}
          </p>
        )}

        <div className={`mt-6 grid gap-4 transition ${loading ? 'opacity-50' : ''}`}>
          {rows.map((t) => {
            const isEditing = editingId === t.id
            const photo = teacherPhotoUrl(t.photo_path)

            return (
              <div key={t.id} className="card">
                {isEditing ? (
                  <div className="grid gap-5">
                    <Field id={`edit-name-${t.id}`} label="Full name">
                      <input
                        id={`edit-name-${t.id}`}
                        className="field"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </Field>
                    <Field id={`edit-bio-${t.id}`} label="Short bio">
                      <textarea
                        id={`edit-bio-${t.id}`}
                        className="field min-h-24"
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                      />
                    </Field>
                    <Field
                      id={`edit-photo-${t.id}`}
                      label={t.photo_path ? 'Replace photo (optional)' : 'Photo (square, under 2 MB)'}
                    >
                      <input
                        id={`edit-photo-${t.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                        className="text-sm text-brand-muted"
                      />
                    </Field>
                    <label className="flex items-start gap-3 text-sm leading-relaxed text-brand-muted">
                      <input
                        type="checkbox"
                        checked={editConsent}
                        onChange={(e) => setEditConsent(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-brand-primary"
                      />
                      <span>The teacher has agreed in writing to publish their name, photo, and bio.</span>
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => saveEdit(t)}
                        disabled={savingId === t.id}
                        className="btn-primary px-4 py-2 text-sm"
                      >
                        {savingId === t.id ? 'Saving' : 'Save changes'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="btn-ghost px-4 py-2 text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      {photo ? (
                        <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft font-serif text-lg text-brand-primary">
                          {t.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-lg font-medium text-brand-text">{t.name}</p>
                        {t.bio && <p className="mt-1 text-sm leading-relaxed text-brand-muted">{t.bio}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="pill">{t.photo_path ? 'Photo added' : 'No photo'}</span>
                          {t.state === 'linked' && <span className="pill">Login active</span>}
                          {t.state === 'unlinked' && (
                            <span className="pill bg-brand-accent-soft text-brand-accent">No login yet</span>
                          )}
                          {t.state === 'no_consent' && (
                            <span className="pill bg-brand-error/10 text-brand-error">No consent</span>
                          )}
                          <span className="pill bg-brand-border/60 text-brand-muted">
                            {t.session_count} {t.session_count === 1 ? 'session' : 'sessions'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                      {!t.user_id && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="email"
                            aria-label={`Email for ${t.name}`}
                            placeholder="teacher@email.com"
                            className="field sm:w-60"
                            value={inviteEmails[t.id] ?? ''}
                            onChange={(e) => setInviteEmails((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => sendInvite(t)}
                            disabled={invitingId === t.id}
                            className="btn-primary whitespace-nowrap px-4 py-2.5 text-sm"
                          >
                            {invitingId === t.id ? 'Sending' : 'Send invite'}
                          </button>
                        </div>
                      )}
                      <div className="flex gap-5 text-sm">
                        <button onClick={() => startEdit(t)} className="text-brand-primary hover:underline">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(t)} className="text-brand-error hover:underline">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {total > 0 && (
          <div className="mt-10 flex items-center justify-between gap-4 border-t border-brand-border pt-8">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || loading}
              className="btn-ghost disabled:opacity-40"
            >
              Previous
            </button>
            <p className="text-sm text-brand-muted">
              {from}–{to} of {total}
            </p>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pages || loading}
              className="btn-ghost disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  )
}