import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import PageHeader from '../../components/PageHeader'
import PayoutForm, { type SavedPayout } from '../../components/PayoutForm'

type TeacherRow = { id: string; name: string }

export default function TeacherPayout() {
  const { user } = useAuth()
  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [saved, setSaved] = useState<SavedPayout | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    let ignore = false
    Promise.all([
      supabase.from('guest_teachers').select('id, name').eq('user_id', user.id).maybeSingle(),
      supabase.functions.invoke('payout-details', { body: { action: 'list' } }),
    ]).then(([teacherRes, listRes]) => {
      if (ignore) return
      setTeacher((teacherRes.data as TeacherRow) ?? null)
      const rows = (listRes.data?.rows as (SavedPayout & { share_role: string })[] | undefined) ?? []
      setSaved(rows.find((r) => r.share_role === 'teacher') ?? null)
      setLoaded(true)
    })
    return () => {
      ignore = true
    }
  }, [user, reloadKey])

  if (!loaded) return <p className="container-page py-16 text-brand-muted">Loading</p>

  if (!teacher) {
    return (
      <section className="container-page py-16">
        <h1 className="text-3xl">Your teacher account is not linked yet</h1>
        <p className="mt-4 text-brand-muted">Contact the Skillbloom admin to link your account.</p>
      </section>
    )
  }

  return (
    <section className="container-page py-12 sm:py-16">
      <Link to="/teacher" className="text-sm text-brand-muted transition hover:text-brand-primary">
        ← Teaching
      </Link>

      <div className="mt-8">
        <PageHeader
          eyebrow="Teaching"
          title="Payout details"
          description="Your share of each session is paid to this account after the session ends. Check that the account name is correct before you save."
        />
      </div>

      <div className="mt-10 max-w-xl">
        <PayoutForm
          shareRole="teacher"
          guestTeacherId={teacher.id}
          title={teacher.name}
          saved={saved}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      </div>
    </section>
  )
}