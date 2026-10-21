import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { formatSessionTime } from '../lib/sessions'
import StudentMaterial, { type MaterialItem } from '../components/StudentMaterial'
import Attachments from '../components/Attachments'
import ChatSection from '../components/ChatSection'
import CertificatePanel from '../components/CertificatePanel'
import PageHeader from '../components/PageHeader'

type Room = {
  title: string
  starts_at: string
  ends_at: string
  status: 'draft' | 'published' | 'cancelled'
  sections: { name: string } | null
  guest_teachers: { name: string } | null
}

type Meeting = {
  meeting_link: string | null
  backup_link: string | null
  meeting_provider: 'zoom' | 'google_meet' | 'other'
}

type AdminMaterial = MaterialItem & {
  published: boolean
  material_files: { file_path: string; file_name: string; size_bytes: number | null }[]
}

const JOIN_LABEL: Record<Meeting['meeting_provider'], string> = {
  zoom: 'Join on Zoom',
  google_meet: 'Join on Google Meet',
  other: 'Join meeting',
}

const KIND_LABEL: Record<MaterialItem['kind'], string> = {
  classwork: 'Classwork',
  assignment: 'Assignment',
  test: 'Test',
}

const JOIN_OPENS_MINUTES_BEFORE = 15
const JOIN_CLOSES_MINUTES_AFTER = 30

const GROUPS: { kind: MaterialItem['kind']; heading: string }[] = [
  { kind: 'classwork', heading: 'Classwork' },
  { kind: 'assignment', heading: 'Assignments' },
  { kind: 'test', heading: 'Tests' },
]

function Notice({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="card mx-auto max-w-lg p-10 text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-3xl">{title}</h1>
        <p className="mt-4 leading-relaxed text-brand-muted">{body}</p>
        <Link to="/dashboard" className="btn-ghost mt-8">
          Back to dashboard
        </Link>
      </div>
    </section>
  )
}

function AdminMaterialPreview({ m }: { m: AdminMaterial }) {
  const due = m.due_at ? formatSessionTime(m.due_at) : null

  return (
    <article className="card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow">{KIND_LABEL[m.kind]}</span>
        <span
          className={`pill ${
            m.published ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-border/60 text-brand-muted'
          }`}
        >
          {m.published ? 'Published' : 'Draft, students cannot see this yet'}
        </span>
      </div>

      <h3 className="mt-3 text-xl">{m.title}</h3>
      {due && <p className="mt-2 text-sm text-brand-muted">Due {due.day}, {due.time}</p>}
      {m.body && <p className="mt-4 whitespace-pre-line leading-relaxed text-brand-text">{m.body}</p>}

      {m.material_files.length > 0 && (
        <div className="mt-5">
          <Attachments
            bucket="materials"
            items={m.material_files.map((f) => ({ path: f.file_path, name: f.file_name, size: f.size_bytes }))}
          />
        </div>
      )}

      {m.kind !== 'classwork' && (
        <p className="mt-5 text-xs text-brand-muted">
          Students submit this from their room. Review submissions in Marking.
        </p>
      )}
    </article>
  )
}

export default function SessionRoom() {
  const { id } = useParams()
  const { user, role, loading } = useAuth()
  const isAdmin = role === 'admin'
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [adminMaterials, setAdminMaterials] = useState<AdminMaterial[]>([])
  const [now, setNow] = useState(() => new Date())

  // Re-check the time every 30 seconds so the join button appears on its own
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (loading || !id || !user) return
    let ignore = false

    const sessionQuery = supabase
      .from('sessions')
      .select('title, starts_at, ends_at, status, sections(name), guest_teachers(name)')
      .eq('id', id)
      .maybeSingle()

    const meetingQuery = supabase
      .from('session_secrets')
      .select('meeting_link, backup_link, meeting_provider')
      .eq('session_id', id)
      .maybeSingle()

    if (isAdmin) {
      Promise.all([
        sessionQuery,
        meetingQuery,
        supabase
          .from('materials')
          .select('id, kind, title, body, due_at, published, material_files(file_path, file_name, size_bytes)')
          .eq('session_id', id)
          .order('created_at'),
      ]).then(([sessionRes, meetingRes, materialRes]) => {
        if (ignore) return
        setAllowed(true)
        setRoom((sessionRes.data as unknown as Room) ?? null)
        setMeeting((meetingRes.data as Meeting) ?? null)
        setAdminMaterials((materialRes.data as unknown as AdminMaterial[]) ?? [])
      })
    } else {
      Promise.all([
        supabase
          .from('purchases')
          .select('access_ends_at')
          .eq('session_id', id)
          .eq('student_id', user.id)
          .eq('status', 'paid')
          .maybeSingle(),
        sessionQuery,
        meetingQuery,
        supabase
          .from('materials')
          .select('id, kind, title, body, due_at')
          .eq('session_id', id)
          .eq('published', true)
          .order('created_at'),
      ]).then(([purchaseRes, sessionRes, meetingRes, materialRes]) => {
        if (ignore) return
        const purchase = purchaseRes.data
        const hasAccess = !!purchase && new Date(purchase.access_ends_at) > new Date()
        setAllowed(hasAccess)
        if (!hasAccess) return

        // Students can't read a cancelled session, so the room will be empty here
        setRoom((sessionRes.data as unknown as Room) ?? null)
        setMeeting((meetingRes.data as Meeting) ?? null)
        setMaterials((materialRes.data as MaterialItem[]) ?? [])
      })
    }

    return () => {
      ignore = true
    }
  }, [id, user, isAdmin, loading])

  if (loading) return <p className="container-page py-16 text-brand-muted">Loading</p>
  if (!user) return <Navigate to="/login" replace />
  if (allowed === null) return <p className="container-page py-16 text-brand-muted">Loading session room</p>

  if (!allowed) {
    return (
      <Notice
        eyebrow="Access needed"
        title="You don't have access to this session"
        body="Buy access from the session page to enter the room."
      />
    )
  }

  if (!room) {
    if (isAdmin) {
      return <Notice eyebrow="Session room" title="Session not found" body="This session could not be loaded." />
    }
    return (
      <Notice
        eyebrow="Cancelled"
        title="This session has been cancelled"
        body="The room is closed. If you paid for this session, your refund is handled by Skillbloom, and you will get an email when it is processed."
      />
    )
  }

  const start = new Date(room.starts_at)
  const end = new Date(room.ends_at)
  const opensAt = new Date(start.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60_000)
  const closesAt = new Date(end.getTime() + JOIN_CLOSES_MINUTES_AFTER * 60_000)
  const inWindow = now >= opensAt && now <= closesAt
  const canJoin = isAdmin || inWindow
  const hasEnded = !isAdmin && now > closesAt
  const cancelled = room.status === 'cancelled'
  const when = formatSessionTime(room.starts_at)

  return (
    <section className="container-page py-12 sm:py-16">
      <Link to="/dashboard" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← Dashboard
      </Link>

      {isAdmin && (
        <div className="mt-6 rounded-xl bg-brand-primary-soft px-5 py-3 text-sm text-brand-primary">
          Admin view. You can join and preview materials without payment.
          {cancelled && ' This session is cancelled, so students cannot enter.'}
        </div>
      )}

      <div className="mt-8">
        <PageHeader
          eyebrow={room.sections?.name}
          title={room.title}
          description={`${when.day}, ${when.time}${room.guest_teachers ? ` · with ${room.guest_teachers.name}` : ''}`}
        />
      </div>

      <div className="card mt-10">
        {hasEnded && (
          <p className="text-brand-text">
            This session has ended. Your materials stay available until your access expires.
          </p>
        )}

        {!hasEnded && !canJoin && (
          <p className="text-brand-text">The join button opens 15 minutes before the session starts.</p>
        )}

        {canJoin && meeting?.meeting_link && (
          <div className="space-y-4">
            <a
              href={meeting.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full sm:w-auto"
            >
              {JOIN_LABEL[meeting.meeting_provider]}
            </a>
            {meeting.backup_link && (
              <p className="text-sm text-brand-muted">
                Having trouble?{' '}
                <a
                  href={meeting.backup_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-accent underline"
                >
                  Use the backup link
                </a>
              </p>
            )}
          </div>
        )}

        {canJoin && !meeting?.meeting_link && (
          <p className="text-brand-text">The teacher hasn't added the meeting link yet. Check back shortly.</p>
        )}
      </div>

      {!isAdmin && <CertificatePanel sessionId={id!} />}

      {!isAdmin && <ChatSection sessionId={id!} />}

      <div className="mt-16">
        <h2 className="text-2xl">Materials</h2>

        {isAdmin ? (
          adminMaterials.length === 0 ? (
            <p className="mt-4 text-brand-muted">No materials have been added to this session yet.</p>
          ) : (
            <div className="mt-6 grid gap-5">
              {adminMaterials.map((m) => (
                <AdminMaterialPreview key={m.id} m={m} />
              ))}
            </div>
          )
        ) : (
          <>
            {materials.length === 0 && (
              <p className="mt-4 text-brand-muted">No materials have been published for this session yet.</p>
            )}

            {GROUPS.map((group) => {
              const items = materials.filter((m) => m.kind === group.kind)
              if (items.length === 0) return null
              return (
                <div key={group.kind} className="mt-10">
                  <p className="eyebrow">{group.heading}</p>
                  <div className="mt-4 grid gap-5">
                    {items.map((m) => (
                      <StudentMaterial key={m.id} material={m} />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </section>
  )
}