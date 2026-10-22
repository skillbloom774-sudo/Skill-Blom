import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { downloadCsv, fileSlug, lagosDateTime, naira, type Column } from '../lib/csv'
import PageHeader from '../components/PageHeader'

type StudentRow = {
  name: string
  email: string | null
  phone: string | null
  paid_at: string | null
  amount_kobo: number | null
  attendance: string
  items_marked: number
  items_total: number
  average_score: number | null
  certificate: string
}

type GradeRow = {
  name: string
  item_title: string
  item_type: string
  score: number | null
  submitted_at: string
  is_late: boolean
}

function studentColumns(admin: boolean): Column[] {
  return [
    { key: 'name', label: 'Name' },
    ...(admin ? [{ key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }] : []),
    { key: 'paid_on', label: 'Paid on' },
    ...(admin ? [{ key: 'amount', label: 'Amount paid (NGN)' }] : []),
    { key: 'attendance', label: 'Attendance' },
    { key: 'items', label: 'Items marked' },
    { key: 'average', label: 'Average score (%)' },
    { key: 'certificate', label: 'Certificate' },
  ]
}

const GRADE_COLUMNS: Column[] = [
  { key: 'student', label: 'Student' },
  { key: 'item', label: 'Item' },
  { key: 'type', label: 'Type' },
  { key: 'score', label: 'Score (%)' },
  { key: 'submitted_on', label: 'Submitted on' },
  { key: 'late', label: 'Late' },
]

function toStudentRecord(r: StudentRow) {
  return {
    name: r.name,
    email: r.email ?? '',
    phone: r.phone ?? '',
    paid_on: lagosDateTime(r.paid_at),
    amount: r.amount_kobo !== null && r.amount_kobo !== undefined ? naira(r.amount_kobo) : '',
    attendance: r.attendance,
    items: `${r.items_marked} of ${r.items_total}`,
    average: r.average_score ?? '',
    certificate: r.certificate,
  }
}

function toGradeRecord(r: GradeRow) {
  return {
    student: r.name,
    item: r.item_title,
    type: r.item_type === 'test' ? 'Test' : 'Assignment',
    score: r.score ?? '',
    submitted_on: lagosDateTime(r.submitted_at),
    late: r.is_late ? 'Yes' : 'No',
  }
}

export default function SessionExports() {
  const { id } = useParams()
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [title, setTitle] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<'students' | 'grades' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let ignore = false

    supabase
      .from('sessions')
      .select('title')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (ignore) return
        setTitle(data?.title ?? null)
        setLoaded(true)
      })

    return () => {
      ignore = true
    }
  }, [id])

  async function exportStudents() {
    if (!id || !title) return
    setBusy('students')
    setError(null)
    setNotice(null)

    const { data, error } = await supabase.rpc('export_session_students', { p_session_id: id })
    setBusy(null)

    if (error) {
      setError(error.message)
      return
    }

    const rows = (data as StudentRow[]) ?? []
    downloadCsv(`${fileSlug(title)}-students`, studentColumns(isAdmin), rows.map(toStudentRecord))
    setNotice(`Downloaded ${rows.length} ${rows.length === 1 ? 'student' : 'students'}.`)
  }

  async function exportGrades() {
    if (!id || !title) return
    setBusy('grades')
    setError(null)
    setNotice(null)

    const { data, error } = await supabase.rpc('export_session_grades', { p_session_id: id })
    setBusy(null)

    if (error) {
      setError(error.message)
      return
    }

    const rows = (data as GradeRow[]) ?? []
    downloadCsv(`${fileSlug(title)}-grades`, GRADE_COLUMNS, rows.map(toGradeRecord))
    setNotice(`Downloaded ${rows.length} ${rows.length === 1 ? 'submission' : 'submissions'}.`)
  }

  if (!loaded) return <p className="container-page py-16 text-brand-muted">Loading exports</p>

  if (!title) {
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

  return (
    <section className="container-page py-12 sm:py-16">
      <Link
        to={isAdmin ? '/admin/sessions' : '/teacher'}
        className="text-sm text-brand-muted transition hover:text-brand-primary"
      >
        ← Back
      </Link>

      <div className="mt-8">
        <PageHeader
          eyebrow="Exports"
          title={title}
          description="Download this session's records as spreadsheets. Each file opens in Excel or Google Sheets."
        />
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <p className="eyebrow">Students and attendance</p>
          <h2 className="mt-2 text-xl">Paying students</h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            One row per paying student, with attendance, how many items are marked, and their average score.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            {isAdmin
              ? 'Includes email, phone, and the amount paid.'
              : 'Names only. Contact details and payment amounts are not included.'}
          </p>
          <button onClick={exportStudents} disabled={busy !== null} className="btn-primary mt-6">
            {busy === 'students' ? 'Preparing' : 'Download students'}
          </button>
        </div>

        <div className="card">
          <p className="eyebrow">Grades</p>
          <h2 className="mt-2 text-xl">Submitted work</h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            One row for each assignment or test a student has submitted. Work not yet submitted does not appear.
          </p>
          <button onClick={exportGrades} disabled={busy !== null} className="btn-primary mt-6">
            {busy === 'grades' ? 'Preparing' : 'Download grades'}
          </button>
        </div>
      </div>

      {error && <p className="mt-8 text-sm text-brand-error">{error}</p>}
      {notice && <p className="mt-8 text-sm text-brand-success">{notice}</p>}
    </section>
  )
}