import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import PayoutForm, { type SavedPayout } from '../../components/PayoutForm'

type Row = SavedPayout & {
  share_role: 'admin' | 'developer' | 'teacher'
  guest_teacher_id: string | null
}

type Teacher = { id: string; name: string }

export default function AdminPayouts() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    Promise.all([
      supabase.functions.invoke('payout-details', { body: { action: 'list' } }),
      supabase.from('guest_teachers').select('id, name').order('name'),
    ]).then(([listRes, teacherRes]) => {
      if (ignore) return
      if (listRes.error) setError('Payout details could not be loaded.')
      setRows((listRes.data?.rows as Row[]) ?? [])
      setTeachers((teacherRes.data as Teacher[]) ?? [])
    })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  function findRow(role: string, teacherId?: string): Row | null {
    return (
      rows?.find((r) => r.share_role === role && (role !== 'teacher' || r.guest_teacher_id === teacherId)) ?? null
    )
  }

  return (
    <section className="container-page py-14 sm:py-20">
      <PageHeader
        eyebrow="Admin"
        title="Payout details"
        description="The bank account each share is paid to. Skillbloom's 30% stays in the Skillbloom balance, so it has no account here."
      />

      {error && <p className="mt-10 text-sm text-brand-error">{error}</p>}
      {rows === null && !error && <p className="mt-10 text-brand-muted">Loading</p>}

      {rows && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <PayoutForm
            shareRole="admin"
            title="Admin"
            saved={findRow('admin')}
            onSaved={reload}
          />
          <PayoutForm
            shareRole="developer"
            title="Developer"
            saved={findRow('developer')}
            onSaved={reload}
          />
        </div>
      )}

      {rows && teachers.length > 0 && (
        <>
          <h2 className="mt-14 text-2xl">Teachers</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {teachers.map((t) => (
              <PayoutForm
                key={t.id}
                shareRole="teacher"
                guestTeacherId={t.id}
                title={t.name}
                saved={findRow('teacher', t.id)}
                onSaved={reload}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}