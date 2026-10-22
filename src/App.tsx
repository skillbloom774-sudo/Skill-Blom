import { Suspense, lazy } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import AdminRoute from './components/AdminRoute'
import TeacherRoute from './components/TeacherRoute'
import SessionViewTracker from './components/SessionViewTracker'
import Home from './pages/Home'
import Sessions from './pages/Sessions'
import SessionDetail from './pages/SessionDetail'
import SessionRoom from './pages/SessionRoom'
import PaymentCallback from './pages/PaymentCallback'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AccessCard from './pages/AccessCard'
import Verify from './pages/Verify'
import Certificate from './pages/Certificate'
import SetPassword from './pages/SetPassword'
import Legal from './pages/Legal'
import Faq from './pages/Faq'
import Profile from './pages/Profile'
import Teachers from './pages/Teachers'
import TeacherProfile from './pages/TeacherProfile'
import { SITE_NAME, SUPPORT_EMAIL } from './lib/site'

// Admin, teacher, and export pages load only when someone opens them
const SessionExports = lazy(() => import('./pages/SessionExports'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminExports = lazy(() => import('./pages/admin/AdminExports'))
const AdminSections = lazy(() => import('./pages/admin/AdminSections'))
const AdminTeachers = lazy(() => import('./pages/admin/AdminTeachers'))
const AdminSessions = lazy(() => import('./pages/admin/AdminSessions'))
const AdminSessionEdit = lazy(() => import('./pages/admin/AdminSessionEdit'))
const AdminDiscounts = lazy(() => import('./pages/admin/AdminDiscounts'))
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'))
const AdminRefunds = lazy(() => import('./pages/admin/AdminRefunds'))
const AdminModeration = lazy(() => import('./pages/admin/AdminModeration'))
const AdminStudents = lazy(() => import('./pages/admin/AdminStudents'))
const AdminStudentDetail = lazy(() => import('./pages/admin/AdminStudentDetail'))
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'))
const TeacherSession = lazy(() => import('./pages/teacher/TeacherSession'))
const TeacherMarking = lazy(() => import('./pages/teacher/TeacherMarking'))
const TeacherChat = lazy(() => import('./pages/teacher/TeacherChat'))
const TeacherAttendance = lazy(() => import('./pages/teacher/TeacherAttendance'))

function Footer() {
  return (
    <footer className="border-t border-brand-border bg-brand-surface">
      <div className="container-page grid gap-8 py-12 md:grid-cols-4">
        <div>
          <span className="font-serif text-lg text-brand-primary">{SITE_NAME}</span>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-brand-muted">
            Live design and tech sessions, taught by working practitioners.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <Link to="/sessions" className="text-brand-muted hover:text-brand-text">Sessions</Link>
          <Link to="/teachers" className="text-brand-muted hover:text-brand-text">Teachers</Link>
          <Link to="/login" className="text-brand-muted hover:text-brand-text">Sign in</Link>
          <Link to="/faq" className="text-brand-muted hover:text-brand-text">FAQ</Link>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <Link to="/terms" className="text-brand-muted hover:text-brand-text">Terms</Link>
          <Link to="/privacy" className="text-brand-muted hover:text-brand-text">Privacy Notice</Link>
          <Link to="/refunds" className="text-brand-muted hover:text-brand-text">Refund Policy</Link>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-muted hover:text-brand-text">
            {SUPPORT_EMAIL}
          </a>
          <span className="pt-2 text-brand-muted">© {new Date().getFullYear()} {SITE_NAME}</span>
        </div>
      </div>
    </footer>
  )
}

function PageLoading() {
  return <p className="container-page py-16 text-brand-muted">Loading</p>
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route
              path="/sessions/:id"
              element={
                <>
                  <SessionDetail />
                  <SessionViewTracker />
                </>
              }
            />
            <Route path="/sessions/:id/room" element={<SessionRoom />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/cards/:cardId" element={<AccessCard />} />
            <Route path="/verify/:cardId" element={<Verify />} />
            <Route path="/certificates/:number" element={<Certificate />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/teachers/:id" element={<TeacherProfile />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
            <Route path="/refunds" element={<Legal doc="refunds" />} />

            <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
            <Route path="/teacher/sessions/:id" element={<TeacherRoute><TeacherSession /></TeacherRoute>} />
            <Route path="/teacher/sessions/:id/marking" element={<TeacherRoute><TeacherMarking /></TeacherRoute>} />
            <Route path="/teacher/sessions/:id/chat" element={<TeacherRoute><TeacherChat /></TeacherRoute>} />
            <Route path="/teacher/sessions/:id/attendance" element={<TeacherRoute><TeacherAttendance /></TeacherRoute>} />
            <Route path="/teacher/sessions/:id/exports" element={<TeacherRoute><SessionExports /></TeacherRoute>} />

            <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
            <Route path="/admin/sections" element={<AdminRoute><AdminSections /></AdminRoute>} />
            <Route path="/admin/teachers" element={<AdminRoute><AdminTeachers /></AdminRoute>} />
            <Route path="/admin/sessions" element={<AdminRoute><AdminSessions /></AdminRoute>} />
            <Route path="/admin/sessions/:id" element={<AdminRoute><AdminSessionEdit /></AdminRoute>} />
            <Route path="/admin/discounts" element={<AdminRoute><AdminDiscounts /></AdminRoute>} />
            <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
            <Route path="/admin/refunds" element={<AdminRoute><AdminRefunds /></AdminRoute>} />
            <Route path="/admin/exports" element={<AdminRoute><AdminExports /></AdminRoute>} />
            <Route path="/admin/moderation" element={<AdminRoute><AdminModeration /></AdminRoute>} />
            <Route path="/admin/students" element={<AdminRoute><AdminStudents /></AdminRoute>} />
            <Route path="/admin/students/:id" element={<AdminRoute><AdminStudentDetail /></AdminRoute>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}