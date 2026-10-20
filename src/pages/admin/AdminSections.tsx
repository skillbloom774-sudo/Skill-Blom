import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

type Section = { id: string; name: string; slug: string; description: string | null }

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Turns database messages into plain language for the admin
function friendlyError(message: string) {
  if (message.includes('duplicate key') || message.includes('sections_slug_key')) {
    return 'A section with a similar name already exists. Choose a different name.'
  }
  if (message.includes('foreign key')) {
    return 'This section is used by sessions, so it cannot be deleted. You can edit it instead.'
  }
  return message
}

export default function AdminSections() {
  const [sections, setSections] = useState<Section[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  function reload() {
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let ignore = false

    Promise.all([
      supabase.from('sections').select('id, name, slug, description').order('name'),
      supabase.from('sessions').select('section_id'),
    ]).then(([secRes, sessRes]) => {
      if (ignore) return
      if (secRes.error) {
        setError(secRes.error.message)
        return
      }

      setSections((secRes.data as Section[]) ?? [])

      // Count how many sessions use each section
      const counts: Record<string, number> = {}
      const rows = (sessRes.data as { section_id: string }[]) ?? []
      for (const row of rows) {
        counts[row.section_id] = (counts[row.section_id] ?? 0) + 1
      }
      setUsage(counts)
    })

    return () => {
      ignore = true
    }
  }, [reloadKey])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (!name.trim()) {
      setError('Give the section a name.')
      return
    }

    setBusy(true)
    const { error } = await supabase.from('sections').insert({
      name: name.trim(),
      slug: slugify(name),
      description: description.trim() || null,
    })
    setBusy(false)

    if (error) {
      setError(friendlyError(error.message))
      return
    }

    setName('')
    setDescription('')
    setNotice('Section added.')
    reload()
  }

  function startEdit(s: Section) {
    setEditingId(s.id)
    setEditName(s.name)
    setEditDescription(s.description ?? '')
    setError(null)
    setNotice(null)
  }

  async function saveEdit(id: string) {
    setError(null)
    setNotice(null)

    if (!editName.trim()) {
      setError('Give the section a name.')
      return
    }

    setBusy(true)
    const { error } = await supabase
      .from('sections')
      .update({
        name: editName.trim(),
        slug: slugify(editName),
        description: editDescription.trim() || null,
      })
      .eq('id', id)
    setBusy(false)

    if (error) {
      setError(friendlyError(error.message))
      return
    }

    setEditingId(null)
    setNotice('Section updated.')
    reload()
  }

  async function handleDelete(s: Section) {
    if ((usage[s.id] ?? 0) > 0) return
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return

    setError(null)
    setNotice(null)
    const { error } = await supabase.from('sections').delete().eq('id', s.id)

    if (error) {
      setError(friendlyError(error.message))
      return
    }

    setNotice('Section deleted.')
    reload()
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-4xl">Sections</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Sections group your monthly sessions, such as Graphic Design or Tech. A section can be
        deleted only when no sessions use it.
      </p>

      <form onSubmit={handleCreate} className="card mt-10 grid gap-5 sm:max-w-xl">
        <h2 className="text-xl">Add a section</h2>
        <div>
          <label className="label" htmlFor="sec-name">Name</label>
          <input
            id="sec-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="sec-desc">Description</label>
          <textarea
            id="sec-desc"
            className="field min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A line or two about what this section covers"
          />
        </div>
        <div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving' : 'Add section'}
          </button>
        </div>
      </form>

      {error && <p className="mt-6 text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-6 text-sm text-brand-success">{notice}</p>}

      <div className="mt-12 grid gap-4">
        {sections.length === 0 && <p className="text-brand-muted">No sections yet.</p>}

        {sections.map((s) => {
          const count = usage[s.id] ?? 0
          const inUse = count > 0
          const isEditing = editingId === s.id

          return (
            <div key={s.id} className="card">
              {isEditing ? (
                <div className="grid gap-4">
                  <div>
                    <label className="label" htmlFor={`edit-name-${s.id}`}>Name</label>
                    <input
                      id={`edit-name-${s.id}`}
                      className="field"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`edit-desc-${s.id}`}>Description</label>
                    <textarea
                      id={`edit-desc-${s.id}`}
                      className="field min-h-24"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => saveEdit(s.id)} disabled={busy} className="btn-primary px-4 py-2 text-sm">
                      Save changes
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost px-4 py-2 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-medium text-brand-text">{s.name}</p>
                    {s.description && <p className="mt-1 text-sm text-brand-muted">{s.description}</p>}
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-brand-muted">
                      {inUse ? `Used by ${count} ${count === 1 ? 'session' : 'sessions'}` : 'Not used yet'}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-3">
                    <button onClick={() => startEdit(s)} className="btn-ghost px-4 py-2 text-sm">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={inUse}
                      title={inUse ? 'Remove or move its sessions before deleting this section' : 'Delete section'}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-brand-error transition hover:bg-brand-error/10 disabled:cursor-not-allowed disabled:text-brand-muted disabled:hover:bg-transparent"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}