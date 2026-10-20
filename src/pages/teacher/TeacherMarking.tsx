import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatSessionTime } from '../../lib/sessions'
import Attachments from '../../components/Attachments'

type Material = { id: string; kind: 'assignment' | 'test'; title: string; due_at: string | null }

type FileRef = { path: string; name: string; size: number | null }

type Row = {
  submission_id: string
  student_id: string
  name: string
  submitted_at: string
  is_late: boolean
  score: number | null
  feedback: string | null
  text_answer: string | null
  files: FileRef[]
}

type Detail = {
  question_id: string
  position: number
  kind: 'mcq' | 'short' | 'long' | 'upload'
  question: string
  options: string[]
  points: number
  prompt_path: string | null
  prompt_name: string | null
  chosen_index: number | null
  text_answer: string | null
  file_path: string | null
  file_name: string | null
  earned: number | null
  feedback: string | null
  correct_index: number | null
}

const LETTER = (i: number) => String.fromCharCode(65 + i)

function when(iso: string) {
  const f = formatSessionTime(iso)
  return `${f.day}, ${f.time}`
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'error' }) {
  return (
    <span className={`pill ${tone === 'error' ? 'bg-brand-error/10 text-brand-error' : ''}`}>{children}</span>
  )
}

function AssignmentRow({ row }: { row: Row }) {
  const [score, setScore] = useState(row.score === null ? '' : String(row.score))
  const [feedback, setFeedback] = useState(row.feedback ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setMessage(null)
    const value = score.trim() === '' ? null : Number(score)
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      setMessage('Score must be between 0 and 100.')
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from('submissions')
      .update({ score: value, feedback: feedback.trim() || null })
      .eq('id', row.submission_id)
    setBusy(false)
    setMessage(error ? error.message : 'Saved.')
  }

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-medium text-brand-text">{row.name}</p>
        <span className="text-sm text-brand-muted">{when(row.submitted_at)}</span>
        {row.is_late && <Pill tone="error">Late</Pill>}
      </div>

      {row.text_answer && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-brand-text">{row.text_answer}</p>
      )}

      {row.files.length > 0 && (
        <div className="mt-4 max-w-xl">
          <Attachments bucket="submissions" items={row.files} />
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:max-w-xl">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <div>
            <label className="label" htmlFor={`score-${row.submission_id}`}>Score (0 to 100)</label>
            <input
              id={`score-${row.submission_id}`}
              type="number"
              min="0"
              max="100"
              className="field"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`feedback-${row.submission_id}`}>Feedback</label>
            <textarea
              id={`feedback-${row.submission_id}`}
              className="field min-h-24"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="A line or two the student will see"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={save} disabled={busy} className="btn-primary px-4 py-2 text-sm">
            {busy ? 'Saving' : 'Save'}
          </button>
          {message && (
            <p className={`text-sm ${message === 'Saved.' ? 'text-brand-success' : 'text-brand-error'}`}>{message}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MarkQuestion({
  d,
  submissionId,
  index,
  onSaved,
}: {
  d: Detail
  submissionId: string
  index: number
  onSaved: () => void
}) {
  const [points, setPoints] = useState(d.earned === null ? '' : String(d.earned))
  const [feedback, setFeedback] = useState(d.feedback ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setMessage(null)
    const value = Number(points)
    if (points.trim() === '' || !Number.isFinite(value) || value < 0 || value > d.points) {
      setMessage(`Enter a mark from 0 to ${d.points}.`)
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc('set_response_marks', {
      p_submission_id: submissionId,
      p_question_id: d.question_id,
      p_points: value,
      p_feedback: feedback.trim() || null,
    })
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Saved.')
    onSaved()
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-brand-border bg-brand-background p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium text-brand-text">
          {index + 1}. {d.question}
        </p>
        <span className="shrink-0 text-sm text-brand-muted">
          {d.points} {d.points === 1 ? 'point' : 'points'}
        </span>
      </div>

      {d.prompt_path && d.prompt_name && (
        <Attachments bucket="materials" items={[{ path: d.prompt_path, name: d.prompt_name }]} />
      )}

      {d.kind === 'mcq' ? (
        <div className="grid gap-2 text-sm">
          {d.options.map((opt, j) => {
            const isCorrect = j === d.correct_index
            const isChosen = j === d.chosen_index
            const tone = isCorrect
              ? 'border-brand-success bg-brand-success/10'
              : isChosen
                ? 'border-brand-error bg-brand-error/10'
                : 'border-brand-border bg-brand-surface'
            return (
              <div key={j} className={`rounded-xl border px-4 py-2.5 ${tone}`}>
                {LETTER(j)}. {opt}
                {isChosen && ' (chosen)'}
                {isCorrect && ' ✓'}
              </div>
            )
          })}
          {d.chosen_index === null && <p className="text-brand-muted">No answer given.</p>}
        </div>
      ) : (
        <div className="grid gap-3 text-sm">
          {d.text_answer ? (
            <p className="whitespace-pre-line leading-relaxed text-brand-text">{d.text_answer}</p>
          ) : (
            <p className="text-brand-muted">No written answer.</p>
          )}
          {d.file_path && d.file_name && (
            <Attachments bucket="submissions" items={[{ path: d.file_path, name: d.file_name }]} />
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <div>
          <label className="label" htmlFor={`pts-${submissionId}-${d.question_id}`}>
            Marks
          </label>
          <input
            id={`pts-${submissionId}-${d.question_id}`}
            type="number"
            min="0"
            max={d.points}
            step="0.5"
            className="field"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          {d.kind === 'mcq' && <p className="mt-1.5 text-xs text-brand-muted">Auto-marked. Change if needed.</p>}
        </div>
        <div>
          <label className="label" htmlFor={`fb-${submissionId}-${d.question_id}`}>Feedback</label>
          <textarea
            id={`fb-${submissionId}-${d.question_id}`}
            className="field min-h-20"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional comment for the student"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy} className="btn-primary px-4 py-2 text-sm">
          {busy ? 'Saving' : 'Save marks'}
        </button>
        {message && (
          <p className={`text-sm ${message === 'Saved.' ? 'text-brand-success' : 'text-brand-error'}`}>{message}</p>
        )}
      </div>
    </div>
  )
}

function TestRow({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<Detail[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadDetail() {
    const { data, error } = await supabase.rpc('test_submission_detail', {
      p_submission_id: row.submission_id,
    })
    if (error) {
      setError(error.message)
      return
    }
    setDetail((data as Detail[]) ?? [])
  }

  function toggle() {
    if (!open && !detail) loadDetail()
    setOpen(!open)
  }

  function refresh() {
    loadDetail()
    onChanged()
  }

  return (
    <div className="py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-medium text-brand-text">{row.name}</p>
          <span className="text-sm text-brand-muted">{when(row.submitted_at)}</span>
          {row.is_late && <Pill tone="error">Late</Pill>}
          <Pill>{row.score === null ? 'Awaiting marking' : `${Number(row.score)}%`}</Pill>
        </div>
        <button onClick={toggle} className="btn-ghost shrink-0 px-4 py-2 text-sm">
          {open ? 'Hide answers' : 'Mark answers'}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-brand-error">{error}</p>}

      {open && detail && (
        <div className="mt-6 grid gap-6">
          {detail.map((d, i) => (
            <MarkQuestion
              key={d.question_id}
              d={d}
              submissionId={row.submission_id}
              index={i}
              onSaved={refresh}
            />
          ))}
        </div>
      )}
      {open && !detail && <p className="mt-4 text-sm text-brand-muted">Loading answers</p>}
    </div>
  )
}

export default function TeacherMarking() {
  const { id } = useParams()
  const [sessionTitle, setSessionTitle] = useState<string | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loaded, setLoaded] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [rosters, setRosters] = useState<Record<string, Row[]>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let ignore = false

    Promise.all([
      supabase.from('sessions').select('title').eq('id', id).maybeSingle(),
      supabase
        .from('materials')
        .select('id, kind, title, due_at')
        .eq('session_id', id)
        .in('kind', ['assignment', 'test'])
        .order('created_at'),
    ]).then(([sessRes, matRes]) => {
      if (ignore) return
      setSessionTitle(sessRes.data?.title ?? null)
      setMaterials((matRes.data as Material[]) ?? [])
      setLoaded(true)
    })

    return () => {
      ignore = true
    }
  }, [id])

  async function loadRoster(materialId: string) {
    const { data, error: rosterError } = await supabase.rpc('submission_roster', {
      p_material_id: materialId,
    })
    if (rosterError) {
      setError(rosterError.message)
      return
    }
    setRosters((prev) => ({ ...prev, [materialId]: (data as Row[]) ?? [] }))
  }

  function toggle(m: Material) {
    if (openId === m.id) {
      setOpenId(null)
      return
    }
    setOpenId(m.id)
    loadRoster(m.id)
  }

  if (!loaded) return <p className="container-page py-16 text-brand-muted">Loading</p>

  if (!sessionTitle) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">Session not found</h1>
        <Link to="/teacher" className="mt-8 inline-block text-sm text-brand-accent underline">
          Back to your sessions
        </Link>
      </section>
    )
  }

  return (
    <section className="container-page py-12 sm:py-16">
      <Link to="/teacher" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← Your sessions
      </Link>

      <p className="eyebrow mt-8">Marking</p>
      <h1 className="mt-3 text-4xl">{sessionTitle}</h1>
      <p className="mt-4 max-w-xl text-brand-muted">
        Open an assignment or test to see who submitted. Multiple-choice answers are marked automatically. You
        mark the rest, and the overall score updates as you go.
      </p>

      {error && <p className="mt-6 text-sm text-brand-error">{error}</p>}

      {materials.length === 0 && (
        <div className="card mt-10 text-brand-muted">
          No assignments or tests yet. Add them from the session's Manage page.
        </div>
      )}

      <div className="mt-10 grid gap-5">
        {materials.map((m) => {
          const isOpen = openId === m.id
          const rows = rosters[m.id]

          return (
            <div key={m.id} className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="eyebrow">{m.kind === 'test' ? 'Test' : 'Assignment'}</span>
                  <p className="mt-2 text-lg font-medium text-brand-text">{m.title}</p>
                  {m.due_at && <p className="mt-1 text-sm text-brand-muted">Due {when(m.due_at)}</p>}
                </div>
                <button onClick={() => toggle(m)} className="btn-ghost shrink-0 px-4 py-2 text-sm">
                  {isOpen ? 'Hide submissions' : 'View submissions'}
                </button>
              </div>

              {isOpen && (
                <div className="mt-6 divide-y divide-brand-border border-t border-brand-border">
                  {!rows && <p className="py-6 text-sm text-brand-muted">Loading submissions</p>}
                  {rows && rows.length === 0 && <p className="py-6 text-sm text-brand-muted">No submissions yet.</p>}
                  {rows?.map((row) =>
                    m.kind === 'test' ? (
                      <TestRow key={row.submission_id} row={row} onChanged={() => loadRoster(m.id)} />
                    ) : (
                      <AssignmentRow key={row.submission_id} row={row} />
                    ),
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}