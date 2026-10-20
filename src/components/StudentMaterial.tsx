import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { formatSessionTime } from '../lib/sessions'
import { uploadFiles, type UploadedFile } from '../lib/files'
import Attachments, { type Attachment } from './Attachments'

export type MaterialItem = {
  id: string
  kind: 'classwork' | 'assignment' | 'test'
  title: string
  body: string | null
  due_at: string | null
}

type QuestionKind = 'mcq' | 'short' | 'long' | 'upload'

type Question = {
  id: string
  position: number
  kind: QuestionKind
  question: string
  options: string[]
  points: number
  prompt_path: string | null
  prompt_name: string | null
}

// Rows from the test_review function, which returns question_id rather than id
type ReviewRow = Omit<Question, 'id'> & {
  question_id: string
  chosen_index: number | null
  text_answer: string | null
  file_path: string | null
  file_name: string | null
  earned: number | null
  feedback: string | null
  correct_index: number | null
}

type Submission = {
  id: string
  submitted_at: string
  is_late: boolean
  score: number | null
  feedback: string | null
  text_answer: string | null
}

type Answer = { chosen?: number; text: string; file: File | null }

const KIND_LABEL: Record<MaterialItem['kind'], string> = {
  classwork: 'Classwork',
  assignment: 'Assignment',
  test: 'Test',
}

const LETTER = (i: number) => String.fromCharCode(65 + i)

const toPayload = (f: UploadedFile) => ({ path: f.path, name: f.name, mime: f.mime, size: f.size })

function when(iso: string) {
  const f = formatSessionTime(iso)
  return `${f.day}, ${f.time}`
}

function toAttachments(rows: { file_path: string; file_name: string; size_bytes?: number | null }[]): Attachment[] {
  return rows.map((r) => ({ path: r.file_path, name: r.file_name, size: r.size_bytes ?? null }))
}

function Result({ score, feedback }: { score: number | null; feedback?: string | null }) {
  return (
    <div className="grid gap-4">
      <p className="font-medium text-brand-text">
        {score === null ? 'Waiting for marking' : `Score: ${Number(score)}/100`}
      </p>
      {feedback && (
        <div className="rounded-xl bg-brand-primary-soft p-4">
          <p className="eyebrow">Feedback from your teacher</p>
          <p className="mt-2 whitespace-pre-line text-brand-text">{feedback}</p>
        </div>
      )}
    </div>
  )
}

export default function StudentMaterial({ material }: { material: MaterialItem }) {
  const { user } = useAuth()
  const [loaded, setLoaded] = useState(false)
  const [attached, setAttached] = useState<Attachment[]>([])
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [submittedFiles, setSubmittedFiles] = useState<Attachment[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [review, setReview] = useState<ReviewRow[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (!user) return
    const uid = user.id
    let ignore = false

    async function load() {
      const { data: attachRows } = await supabase
        .from('material_files')
        .select('file_path, file_name, size_bytes')
        .eq('material_id', material.id)
      if (ignore) return
      setAttached(
        toAttachments((attachRows as { file_path: string; file_name: string; size_bytes: number | null }[]) ?? []),
      )

      if (material.kind === 'classwork') {
        setLoaded(true)
        return
      }

      const { data: sub } = await supabase
        .from('submissions')
        .select('id, submitted_at, is_late, score, feedback, text_answer')
        .eq('material_id', material.id)
        .eq('student_id', uid)
        .maybeSingle()
      if (ignore) return
      setSubmission((sub as Submission) ?? null)

      if (sub) {
        const { data: sf } = await supabase
          .from('submission_files')
          .select('file_path, file_name, size_bytes')
          .eq('submission_id', (sub as Submission).id)
        if (!ignore) {
          setSubmittedFiles(
            toAttachments((sf as { file_path: string; file_name: string; size_bytes: number | null }[]) ?? []),
          )
        }
      }

      if (material.kind === 'test') {
        if (sub) {
          const { data } = await supabase.rpc('test_review', { p_material_id: material.id })
          if (!ignore) setReview((data as ReviewRow[]) ?? [])
        } else {
          const { data } = await supabase
            .from('test_questions')
            .select('id, position, kind, question, options, points, prompt_path, prompt_name')
            .eq('material_id', material.id)
            .order('position')
          if (!ignore) setQuestions((data as Question[]) ?? [])
        }
      }

      if (!ignore) setLoaded(true)
    }

    load()
    return () => {
      ignore = true
    }
  }, [material.id, material.kind, user, reloadKey])

  function setAnswer(questionId: string, patch: Partial<Answer>) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] ?? { text: '', file: null }), ...patch },
    }))
  }

  async function submitAssignment(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    if (!text.trim() && files.length === 0) {
      setError('Write your answer or attach a file.')
      return
    }

    setBusy(true)
    const up = await uploadFiles('submissions', `${material.id}/${user.id}`, files)
    if (up.error) {
      setBusy(false)
      setError(up.error)
      return
    }

    const { error: submitError } = await supabase.rpc('submit_assignment', {
      p_material_id: material.id,
      p_text: text.trim() || null,
      p_files: up.files.map(toPayload),
    })
    setBusy(false)

    if (submitError) {
      if (up.files.length) await supabase.storage.from('submissions').remove(up.files.map((f) => f.path))
      setError(submitError.message)
      return
    }

    setText('')
    setFiles([])
    setFormKey((k) => k + 1)
    setReloadKey((k) => k + 1)
  }

  async function submitTest() {
    if (!user) return
    setError(null)

    const incomplete = questions.filter((q) => {
      const a = answers[q.id]
      if (q.kind === 'mcq') return a?.chosen === undefined
      if (q.kind === 'upload') return !a?.file
      return !a?.text.trim()
    }).length

    if (incomplete > 0) {
      setError(`Answer every question first. ${incomplete} still open.`)
      return
    }
    if (!confirm('You can submit this test only once. Submit now?')) return

    setBusy(true)
    const payload: Record<string, unknown>[] = []

    for (const q of questions) {
      const a = answers[q.id]
      const item: Record<string, unknown> = { question_id: q.id }

      if (q.kind === 'mcq') {
        item.chosen_index = a?.chosen
      } else if (q.kind === 'upload') {
        const up = await uploadFiles('submissions', `${material.id}/${user.id}`, [a!.file!])
        if (up.error || !up.files[0]) {
          setBusy(false)
          setError(up.error ?? 'The file could not be uploaded.')
          return
        }
        item.file = toPayload(up.files[0])
        if (a?.text.trim()) item.text = a.text.trim()
      } else {
        item.text = a?.text.trim() ?? ''
      }

      payload.push(item)
    }

    const { error: submitError } = await supabase.rpc('submit_test', {
      p_material_id: material.id,
      p_answers: payload,
    })
    setBusy(false)

    if (submitError) {
      setError(submitError.message)
      return
    }

    setAnswers({})
    setReloadKey((k) => k + 1)
  }

  return (
    <article className="card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow">{KIND_LABEL[material.kind]}</span>
        {submission && <span className="pill bg-brand-success/10 text-brand-success">Submitted</span>}
        {submission?.is_late && <span className="pill bg-brand-error/10 text-brand-error">Late</span>}
      </div>

      <h3 className="mt-3 text-xl">{material.title}</h3>
      {material.due_at && <p className="mt-2 text-sm text-brand-muted">Due {when(material.due_at)}</p>}
      {material.body && <p className="mt-4 whitespace-pre-line leading-relaxed text-brand-text">{material.body}</p>}

      {attached.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-3">Files</p>
          <Attachments bucket="materials" items={attached} />
        </div>
      )}

      {!loaded && material.kind !== 'classwork' && <p className="mt-6 text-sm text-brand-muted">Loading</p>}

      {/* Assignment, after submitting */}
      {loaded && material.kind === 'assignment' && submission && (
        <div className="mt-6 grid gap-4 border-t border-brand-border pt-6 text-sm">
          <p className="text-brand-muted">Submitted {when(submission.submitted_at)}</p>
          {submission.text_answer && <p className="whitespace-pre-line text-brand-text">{submission.text_answer}</p>}
          {submittedFiles.length > 0 && <Attachments bucket="submissions" items={submittedFiles} />}
          <Result score={submission.score} feedback={submission.feedback} />
        </div>
      )}

      {/* Assignment, before submitting */}
      {loaded && material.kind === 'assignment' && !submission && (
        <form key={formKey} onSubmit={submitAssignment} className="mt-6 grid gap-4 border-t border-brand-border pt-6">
          <textarea
            className="field min-h-32"
            placeholder="Write your answer (optional if you attach files)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div>
            <label className="label">Attach files (any format, up to 50 MB each)</label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="text-sm text-brand-muted"
            />
            {files.length > 0 && <p className="mt-2 text-xs text-brand-muted">{files.length} selected</p>}
          </div>
          <div>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Submitting' : 'Submit assignment'}
            </button>
          </div>
          <p className="text-xs text-brand-muted">You can submit once, so check everything before sending.</p>
        </form>
      )}

      {/* Test, after submitting */}
      {loaded && material.kind === 'test' && submission && (
        <div className="mt-6 border-t border-brand-border pt-6">
          <Result score={submission.score} />

          <div className="mt-8 grid gap-8">
            {review.map((r, i) => (
              <div key={r.question_id}>
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium text-brand-text">
                    {i + 1}. {r.question}
                  </p>
                  <span className="shrink-0 text-sm text-brand-muted">
                    {r.earned === null ? 'Awaiting marking' : `${r.earned}/${r.points}`}
                  </span>
                </div>

                {r.prompt_path && r.prompt_name && (
                  <div className="mt-3">
                    <Attachments bucket="materials" items={[{ path: r.prompt_path, name: r.prompt_name }]} />
                  </div>
                )}

                <div className="mt-3 grid gap-2 text-sm">
                  {r.kind === 'mcq' ? (
                    r.options.map((opt, j) => {
                      const isCorrect = j === r.correct_index
                      const isChosen = j === r.chosen_index
                      const tone = isCorrect
                        ? 'border-brand-success bg-brand-success/10'
                        : isChosen
                          ? 'border-brand-error bg-brand-error/10'
                          : 'border-brand-border'
                      return (
                        <div key={j} className={`rounded-xl border px-4 py-2.5 ${tone}`}>
                          {LETTER(j)}. {opt}
                          {isCorrect && ' ✓'}
                          {isChosen && !isCorrect && ' (your answer)'}
                        </div>
                      )
                    })
                  ) : (
                    <>
                      {r.text_answer && <p className="whitespace-pre-line text-brand-text">{r.text_answer}</p>}
                      {r.file_path && r.file_name && (
                        <Attachments bucket="submissions" items={[{ path: r.file_path, name: r.file_name }]} />
                      )}
                    </>
                  )}
                </div>

                {r.feedback && <p className="mt-3 rounded-xl bg-brand-primary-soft p-4 text-sm text-brand-text">{r.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test, before submitting */}
      {loaded && material.kind === 'test' && !submission && (
        <div className="mt-6 grid gap-8 border-t border-brand-border pt-6">
          {questions.length === 0 && <p className="text-sm text-brand-muted">No questions yet.</p>}

          {questions.map((q, i) => {
            const a = answers[q.id]
            return (
              <div key={q.id}>
                <p className="font-medium text-brand-text">
                  {i + 1}. {q.question}{' '}
                  <span className="text-sm font-normal text-brand-muted">
                    ({q.points} {q.points === 1 ? 'point' : 'points'})
                  </span>
                </p>

                {q.prompt_path && q.prompt_name && (
                  <div className="mt-3">
                    <Attachments bucket="materials" items={[{ path: q.prompt_path, name: q.prompt_name }]} />
                  </div>
                )}

                <div className="mt-3">
                  {q.kind === 'mcq' && (
                    <div className="grid gap-2">
                      {q.options.map((opt, j) => {
                        const selected = a?.chosen === j
                        return (
                          <label
                            key={j}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
                              selected
                                ? 'border-brand-primary bg-brand-primary-soft'
                                : 'border-brand-border hover:border-brand-primary'
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              checked={selected}
                              onChange={() => setAnswer(q.id, { chosen: j })}
                              className="accent-brand-primary"
                            />
                            <span>
                              {LETTER(j)}. {opt}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {q.kind === 'short' && (
                    <input
                      className="field"
                      placeholder="Your answer"
                      value={a?.text ?? ''}
                      onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                    />
                  )}

                  {q.kind === 'long' && (
                    <textarea
                      className="field min-h-32"
                      placeholder="Write your answer"
                      value={a?.text ?? ''}
                      onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                    />
                  )}

                  {q.kind === 'upload' && (
                    <div className="grid gap-3">
                      <input
                        type="file"
                        onChange={(e) => setAnswer(q.id, { file: e.target.files?.[0] ?? null })}
                        className="text-sm text-brand-muted"
                      />
                      <textarea
                        className="field"
                        placeholder="A note about your upload (optional)"
                        value={a?.text ?? ''}
                        onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {questions.length > 0 && (
            <div>
              <button onClick={submitTest} disabled={busy} className="btn-primary">
                {busy ? 'Submitting' : 'Submit test'}
              </button>
              <p className="mt-3 text-xs text-brand-muted">
                You can submit once. Multiple-choice answers are marked straight away, and your teacher marks the rest.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-6 text-sm text-brand-error">{error}</p>}
    </article>
  )
}