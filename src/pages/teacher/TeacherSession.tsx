import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { formatSessionTime } from '../../lib/sessions'
import { uploadFiles } from '../../lib/files'
import Attachments from '../../components/Attachments'

type Session = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  sections: { name: string } | null
}

type Material = {
  id: string
  kind: 'classwork' | 'assignment' | 'test'
  title: string
  body: string | null
  due_at: string | null
  published: boolean
  material_files: { file_path: string; file_name: string; size_bytes: number | null }[]
}

type Provider = 'zoom' | 'google_meet' | 'other'
type QuestionKind = 'mcq' | 'short' | 'long' | 'upload'

type Draft = {
  kind: QuestionKind
  text: string
  options: string[]
  correct: number
  points: number
  prompt: File | null
}

const PROVIDER_TEXT: Record<Provider, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  other: 'Other',
}

const PROVIDER_PLACEHOLDER: Record<Provider, string> = {
  zoom: 'https://zoom.us/j/...',
  google_meet: 'https://meet.google.com/abc-defg-hij',
  other: 'https://',
}

const KIND_TEXT: Record<QuestionKind, string> = {
  mcq: 'Multiple choice (marked automatically)',
  short: 'Short answer',
  long: 'Long answer or theory',
  upload: 'Practical or image upload',
}

const KIND_HINT: Record<QuestionKind, string> = {
  mcq: 'Students pick one option. Tick the correct one.',
  short: 'Students type a short reply. You mark it.',
  long: 'Students write a longer answer or explanation. You mark it.',
  upload: 'Students upload a photo or file as their answer. You mark it.',
}

const blankQuestion = (): Draft => ({
  kind: 'mcq',
  text: '',
  options: ['', '', '', ''],
  correct: 0,
  points: 1,
  prompt: null,
})

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-brand-muted">{hint}</p>}
    </div>
  )
}

export default function TeacherSession() {
  const { id } = useParams()
  const { user, loading } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loaded, setLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const [provider, setProvider] = useState<Provider>('zoom')
  const [meetingLink, setMeetingLink] = useState('')
  const [backupLink, setBackupLink] = useState('')
  const [meetingMsg, setMeetingMsg] = useState<string | null>(null)

  const [kind, setKind] = useState<'classwork' | 'assignment' | 'test'>('classwork')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [published, setPublished] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [questions, setQuestions] = useState<Draft[]>([blankQuestion()])

  useEffect(() => {
    if (!id) return
    let ignore = false

    Promise.all([
      supabase.from('sessions').select('id, title, starts_at, ends_at, sections(name)').eq('id', id).maybeSingle(),
      supabase
        .from('materials')
        .select('id, kind, title, body, due_at, published, material_files(file_path, file_name, size_bytes)')
        .eq('session_id', id)
        .order('created_at'),
      supabase
        .from('session_secrets')
        .select('meeting_link, backup_link, meeting_provider')
        .eq('session_id', id)
        .maybeSingle(),
    ]).then(([sessRes, matRes, meetingRes]) => {
      if (ignore) return
      setSession((sessRes.data as unknown as Session) ?? null)
      setMaterials((matRes.data as unknown as Material[]) ?? [])
      setProvider((meetingRes.data?.meeting_provider as Provider) ?? 'zoom')
      setMeetingLink(meetingRes.data?.meeting_link ?? '')
      setBackupLink(meetingRes.data?.backup_link ?? '')
      setLoaded(true)
    })

    return () => {
      ignore = true
    }
  }, [id, reloadKey])

  if (loading) return <p className="container-page py-16 text-brand-muted">Loading</p>
  if (!user) return <Navigate to="/login" replace />
  if (!loaded) return <p className="container-page py-16 text-brand-muted">Loading session</p>

  if (!session) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">Session not found</h1>
        <p className="mt-4 text-brand-muted">It may not be assigned to you.</p>
        <Link to="/teacher" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to your sessions
        </Link>
      </section>
    )
  }

  const when = formatSessionTime(session.starts_at)

  function fail(message: string) {
    setBusy(false)
    setError(message)
  }

  function updateQ(i: number, patch: Partial<Draft>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }

  function updateOption(i: number, j: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === i ? { ...q, options: q.options.map((o, k) => (k === j ? value : o)) } : q,
      ),
    )
  }

  async function saveMeeting(e: FormEvent) {
    e.preventDefault()
    setMeetingMsg(null)

    const link = meetingLink.trim()
    if (link && !link.startsWith('https://')) {
      setMeetingMsg('The link must start with https://')
      return
    }

    const { error } = await supabase
      .from('session_secrets')
      .update({
        meeting_provider: provider,
        meeting_link: link || null,
        backup_link: backupLink.trim() || null,
      })
      .eq('session_id', session!.id)
    setMeetingMsg(error ? error.message : 'Saved.')
  }

  async function addMaterial(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (kind === 'test') {
      if (questions.length === 0) return fail('Add at least one question.')
      for (const q of questions) {
        if (!q.text.trim()) return fail('Every question needs its text.')
        if (!(q.points >= 1)) return fail('Each question needs at least 1 point.')
        if (q.kind === 'mcq' && q.options.some((o) => !o.trim())) {
          return fail('Fill in every multiple-choice option.')
        }
      }
    }

    setBusy(true)

    const { data: material, error: matError } = await supabase
      .from('materials')
      .insert({
        session_id: session!.id,
        kind,
        title: title.trim(),
        body: body.trim() || null,
        due_at: kind !== 'classwork' && dueAt ? new Date(dueAt).toISOString() : null,
        published,
      })
      .select('id')
      .single()

    if (matError || !material) return fail(matError?.message ?? 'The material could not be saved.')

    if (files.length > 0) {
      const up = await uploadFiles('materials', material.id, files)
      if (up.error) return fail(up.error)
      const { error: fileError } = await supabase.from('material_files').insert(
        up.files.map((f) => ({
          material_id: material.id,
          file_path: f.path,
          file_name: f.name,
          mime_type: f.mime,
          size_bytes: f.size,
        })),
      )
      if (fileError) return fail(fileError.message)
    }

    if (kind === 'test') {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        let promptPath: string | null = null
        let promptName: string | null = null

        if (q.prompt) {
          const up = await uploadFiles('materials', `${material.id}/questions`, [q.prompt])
          if (up.error || !up.files[0]) return fail(up.error ?? 'The question file could not be uploaded.')
          promptPath = up.files[0].path
          promptName = up.files[0].name
        }

        const { data: row, error: qError } = await supabase
          .from('test_questions')
          .insert({
            material_id: material.id,
            position: i,
            question: q.text.trim(),
            kind: q.kind,
            points: q.points,
            options: q.kind === 'mcq' ? q.options.map((o) => o.trim()) : [],
            prompt_path: promptPath,
            prompt_name: promptName,
          })
          .select('id')
          .single()

        if (qError || !row) return fail(qError?.message ?? 'A question could not be saved.')

        if (q.kind === 'mcq') {
          const { error: keyError } = await supabase
            .from('test_answer_keys')
            .insert({ question_id: row.id, correct_index: q.correct })
          if (keyError) return fail(keyError.message)
        }
      }
    }

    setBusy(false)
    setTitle('')
    setBody('')
    setDueAt('')
    setPublished(false)
    setFiles([])
    setQuestions([blankQuestion()])
    setFormKey((k) => k + 1)
    setNotice('Added.')
    setReloadKey((k) => k + 1)
  }

  async function togglePublished(m: Material) {
    const { error } = await supabase.from('materials').update({ published: !m.published }).eq('id', m.id)
    if (error) setError(error.message)
    else setReloadKey((k) => k + 1)
  }

  async function removeMaterial(m: Material) {
    if (!confirm(`Delete "${m.title}" and its files?`)) return
    const paths = m.material_files.map((f) => f.file_path)
    const { error } = await supabase.from('materials').delete().eq('id', m.id)
    if (error) {
      setError(error.message)
      return
    }
    if (paths.length) await supabase.storage.from('materials').remove(paths)
    setReloadKey((k) => k + 1)
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <Link to="/teacher" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← Your sessions
      </Link>

      <p className="eyebrow mt-8">{session.sections?.name}</p>
      <h1 className="mt-3 text-4xl">{session.title}</h1>
      <p className="mt-3 text-brand-muted">{when.day}, {when.time}</p>

      {/* Meeting */}
      <form onSubmit={saveMeeting} className="card mt-12 grid gap-5 sm:max-w-2xl">
        <h2 className="text-xl">Meeting</h2>

        <Field id="mt-provider" label="Platform">
          <select
            id="mt-provider"
            className="field"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            <option value="zoom">{PROVIDER_TEXT.zoom}</option>
            <option value="google_meet">{PROVIDER_TEXT.google_meet}</option>
            <option value="other">{PROVIDER_TEXT.other}</option>
          </select>
        </Field>

        <Field id="mt-link" label={`${PROVIDER_TEXT[provider]} link`}>
          <input
            id="mt-link"
            type="url"
            className="field"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder={PROVIDER_PLACEHOLDER[provider]}
          />
        </Field>

        <Field id="mt-backup" label="Backup link (optional)">
          <input
            id="mt-backup"
            type="url"
            className="field"
            value={backupLink}
            onChange={(e) => setBackupLink(e.target.value)}
          />
        </Field>

        <p className="text-xs text-brand-muted">
          Students see the join button 15 minutes before the start time. Only paying students can see these links.
          For Google Meet, create the meeting in Google Calendar or Meet and paste the link here.
        </p>

        {meetingMsg && (
          <p className={`text-sm ${meetingMsg === 'Saved.' ? 'text-brand-success' : 'text-brand-error'}`}>
            {meetingMsg}
          </p>
        )}
        <div>
          <button type="submit" className="btn-primary">Save meeting</button>
        </div>
      </form>

      {/* Existing materials */}
      <div className="mt-16">
        <h2 className="text-2xl">Materials</h2>
        {materials.length === 0 && <p className="mt-4 text-brand-muted">Nothing added yet.</p>}

        <div className="mt-6 grid gap-4">
          {materials.map((m) => (
            <div key={m.id} className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="eyebrow">{m.kind}</span>
                  <p className="mt-1.5 text-lg font-medium text-brand-text">{m.title}</p>
                  {m.due_at && (
                    <p className="mt-1 text-sm text-brand-muted">
                      Due {formatSessionTime(m.due_at).day}, {formatSessionTime(m.due_at).time}
                    </p>
                  )}
                  <span className={`pill mt-3 ${m.published ? 'bg-brand-success/10 text-brand-success' : ''}`}>
                    {m.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="flex gap-5 text-sm">
                  <button onClick={() => togglePublished(m)} className="text-brand-primary hover:underline">
                    {m.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => removeMaterial(m)} className="text-brand-error hover:underline">
                    Delete
                  </button>
                </div>
              </div>

              {m.material_files.length > 0 && (
                <div className="mt-5">
                  <Attachments
                    bucket="materials"
                    items={m.material_files.map((f) => ({
                      path: f.file_path,
                      name: f.file_name,
                      size: f.size_bytes,
                    }))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add material */}
      <form key={formKey} onSubmit={addMaterial} className="card mt-16 grid gap-6 sm:max-w-3xl">
        <h2 className="text-xl">Add to this session</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="m-kind" label="Type">
            <select id="m-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="classwork">Classwork</option>
              <option value="assignment">Assignment</option>
              <option value="test">Test</option>
            </select>
          </Field>
          <Field id="m-title" label="Title">
            <input id="m-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
        </div>

        <Field id="m-body" label="Instructions or content (optional)">
          <textarea id="m-body" className="field min-h-28" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>

        {kind !== 'classwork' && (
          <Field id="m-due" label="Due date and time">
            <input
              id="m-due"
              type="datetime-local"
              className="field sm:max-w-xs"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </Field>
        )}

        <Field id="m-files" label="Attach files (any format, up to 50 MB each)" hint="Slides, PDFs, videos, spreadsheets, images, code, anything.">
          <input
            id="m-files"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm text-brand-muted"
          />
          {files.length > 0 && <p className="mt-2 text-xs text-brand-muted">{files.length} selected</p>}
        </Field>

        {kind === 'test' && (
          <div className="grid gap-6">
            <p className="eyebrow">Questions</p>

            {questions.map((q, i) => (
              <div key={i} className="grid gap-4 rounded-2xl border border-brand-border bg-brand-background p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="eyebrow">Question {i + 1}</p>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}
                      className="text-sm text-brand-error hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <div>
                    <select
                      className="field"
                      aria-label="Question type"
                      value={q.kind}
                      onChange={(e) => updateQ(i, { kind: e.target.value as QuestionKind })}
                    >
                      {(Object.keys(KIND_TEXT) as QuestionKind[]).map((k) => (
                        <option key={k} value={k}>{KIND_TEXT[k]}</option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-brand-muted">{KIND_HINT[q.kind]}</p>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="1"
                      className="field"
                      aria-label="Points"
                      value={q.points}
                      onChange={(e) => updateQ(i, { points: Number(e.target.value) })}
                    />
                    <p className="mt-1.5 text-xs text-brand-muted">Points</p>
                  </div>
                </div>

                <textarea
                  className="field min-h-20"
                  placeholder="Write the question or task"
                  value={q.text}
                  onChange={(e) => updateQ(i, { text: e.target.value })}
                />

                {q.kind === 'mcq' && (
                  <div className="grid gap-2">
                    {q.options.map((opt, j) => (
                      <label key={j} className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`correct-${i}`}
                          checked={q.correct === j}
                          onChange={() => updateQ(i, { correct: j })}
                          className="accent-brand-primary"
                        />
                        <input
                          className="field"
                          placeholder={`Option ${String.fromCharCode(65 + j)}`}
                          value={opt}
                          onChange={(e) => updateOption(i, j, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <div>
                  <label className="label" htmlFor={`qfile-${i}`}>Image or file for this question (optional)</label>
                  <input
                    id={`qfile-${i}`}
                    type="file"
                    onChange={(e) => updateQ(i, { prompt: e.target.files?.[0] ?? null })}
                    className="text-sm text-brand-muted"
                  />
                  {q.prompt && <p className="mt-2 text-xs text-brand-muted">Selected: {q.prompt.name}</p>}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
              className="btn-ghost w-fit"
            >
              Add question
            </button>
          </div>
        )}

        <label className="flex items-center gap-3 text-sm text-brand-muted">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-brand-primary"
          />
          Publish now (students can see it immediately)
        </label>

        {error && <p className="text-sm text-brand-error">{error}</p>}
        {notice && <p className="text-sm text-brand-success">{notice}</p>}

        <div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving' : 'Add'}
          </button>
        </div>
      </form>
    </section>
  )
}