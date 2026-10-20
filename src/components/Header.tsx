import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

export default function Header() {
  const { user, role, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = role === 'admin'
  const isGuestTeacher = role === 'guest_teacher'
  // Admins manage sessions and guest teachers buy nothing, so neither sees the public session list
  const showSessions = !isAdmin && !isGuestTeacher
  const showTeaching = isGuestTeacher
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? ''
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition ${
      isActive ? 'font-medium text-brand-primary' : 'text-brand-muted hover:text-brand-text'
    }`

  const menuItem = 'block px-4 py-2.5 text-brand-text hover:bg-brand-primary-soft'

  return (
    <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-background/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-8">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-8 w-8" />
            <span className="font-serif text-xl font-medium text-brand-primary">Skillbloom</span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {showSessions && <NavLink to="/sessions" className={navClass}>Sessions</NavLink>}
            {user && <NavLink to="/dashboard" className={navClass}>My learning</NavLink>}
            {showTeaching && <NavLink to="/teacher" className={navClass}>Teaching</NavLink>}
          </nav>
        </div>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className="flex items-center gap-3 rounded-full border border-brand-border bg-brand-surface py-1.5 pl-1.5 pr-4 text-sm transition hover:border-brand-primary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-medium text-white">
                {initial}
              </span>
              <span className="hidden max-w-[10rem] truncate text-brand-text sm:block">{name}</span>
            </button>

            {menuOpen && (
              <div
                onClick={() => setMenuOpen(false)}
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-lg"
              >
                <div className="border-b border-brand-border px-4 py-3">
                  <p className="text-sm font-medium capitalize text-brand-text">{role ?? 'Member'}</p>
                  <p className="truncate text-xs text-brand-muted">{user.email}</p>
                </div>

                <div className="py-2 text-sm">
                  {showSessions && (
                    <Link to="/sessions" className={`${menuItem} md:hidden`}>Sessions</Link>
                  )}
                  <Link to="/dashboard" className={menuItem}>My learning</Link>
                  {showTeaching && <Link to="/teacher" className={menuItem}>Teaching</Link>}
                  <Link to="/profile" className={menuItem}>Your details</Link>
                </div>

                {isAdmin && (
                  <div className="border-t border-brand-border py-2 text-sm">
                    <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                      Admin
                    </p>
                    <Link to="/admin/sessions" className={menuItem}>Manage sessions</Link>
                    <Link to="/admin/students" className={menuItem}>Students</Link>
                    <Link to="/admin/discounts" className={menuItem}>Discount codes</Link>
                    <Link to="/admin/payments" className={menuItem}>Payments</Link>
                    <Link to="/admin/refunds" className={menuItem}>Refund requests</Link>
                    <Link to="/admin/moderation" className={menuItem}>Moderation</Link>
                    <Link to="/admin/sections" className={menuItem}>Sections</Link>
                    <Link to="/admin/teachers" className={menuItem}>Teachers</Link>
                  </div>
                )}

                <div className="border-t border-brand-border py-2 text-sm">
                  <button
                    onClick={signOut}
                    className="block w-full px-4 py-2.5 text-left text-brand-error hover:bg-brand-primary-soft"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn-primary px-5 py-2.5 text-sm">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}