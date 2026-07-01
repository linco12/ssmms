import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'

// Use HashRouter in Electron (file:// protocol can't use HTML5 history)
const Router = (typeof window !== 'undefined' && window.isElectron) ? HashRouter : BrowserRouter
import { AuthProvider, useAuth } from './context/AuthContext'
import { OfflineProvider } from './context/OfflineContext'
import { FeatureFlagsProvider } from './context/FeatureFlagsContext'
import { DeleteKeyProvider } from './context/DeleteKeyContext'
import ProtectedRoute, { DeveloperRoute } from './components/ProtectedRoute'
import { useNotifications } from './hooks/useNotifications'

function NotificationInitializer() {
  useNotifications()
  return null
}

import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import DevSettingsPage from './pages/DevSettingsPage'

import AdminLayout from './components/layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import StudentsPage from './pages/admin/StudentsPage'
import ClassesPage from './pages/admin/ClassesPage'
import PromotePage from './pages/admin/PromotePage'
import EnrollmentPage from './pages/admin/EnrollmentPage'
import FeeOverviewPage from './pages/admin/FeeOverviewPage'
import ReportsPage from './pages/admin/ReportsPage'
import AuditLogPage from './pages/admin/AuditLogPage'
import BroadcastPage from './pages/admin/BroadcastPage'
import UsersPage from './pages/admin/UsersPage'
import SubjectsPage from './pages/admin/SubjectsPage'
import AssessmentsPage from './pages/admin/AssessmentsPage'
import NewsPage from './pages/admin/NewsPage'
import GalleryPage from './pages/admin/GalleryPage'
import SchoolFeesPage from './pages/admin/SchoolFeesPage'
import CalendarPage from './pages/admin/CalendarPage'
import TimetablePage from './pages/admin/TimetablePage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import CalendarViewPage from './pages/shared/CalendarViewPage'
import StudentTimetablePage from './pages/student/StudentTimetablePage'
import TeacherTimetablePage from './pages/teacher/TeacherTimetablePage'

import FinanceLayout from './components/layouts/FinanceLayout'
import FinanceDashboard from './pages/finance/FinanceDashboard'
import RecordPaymentPage from './pages/finance/RecordPaymentPage'
import TransactionsPage from './pages/finance/TransactionsPage'
import FinanceReportsPage from './pages/finance/FinanceReportsPage'

import TeacherLayout from './components/layouts/TeacherLayout'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import ResultsPage from './pages/teacher/ResultsPage'
import AttendancePage from './pages/teacher/AttendancePage'
import AssignmentsPage from './pages/teacher/AssignmentsPage'
import TeacherNotifyPage from './pages/teacher/TeacherNotifyPage'

import ParentLayout from './components/layouts/ParentLayout'
import ParentDashboard from './pages/parent/ParentDashboard'
import ParentFeesPage from './pages/parent/ParentFeesPage'
import ParentResultsPage from './pages/parent/ParentResultsPage'
import ParentNotificationsPage from './pages/parent/ParentNotificationsPage'
import WhatsAppSimPage from './pages/parent/WhatsAppSimPage'
import ParentNewsPage from './pages/parent/NewsPage'
import ParentGalleryPage from './pages/parent/GalleryPage'

import StudentLayout from './components/layouts/StudentLayout'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentResultsPage from './pages/student/StudentResultsPage'
import StudentFeesPage from './pages/student/StudentFeesPage'
import StudentAssignmentsPage from './pages/student/StudentAssignmentsPage'
import StudentNotificationsPage from './pages/student/StudentNotificationsPage'
import StudentNewsPage from './pages/student/StudentNewsPage'
import StudentGalleryPage from './pages/student/StudentGalleryPage'

function RoleRedirect() {
  const { userProfile } = useAuth()
  const ROLE_HOME = {
    admin: '/admin',
    finance: '/finance',
    teacher: '/teacher',
    parent: '/parent',
    student: '/student',
  }
  const dest = ROLE_HOME[userProfile?.role] || '/login'
  return <Navigate to={dest} replace />
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <FeatureFlagsProvider>
        <OfflineProvider>
          <DeleteKeyProvider>
          <NotificationInitializer />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/dev-settings" element={<DeveloperRoute><DevSettingsPage /></DeveloperRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="promote" element={<PromotePage />} />
              <Route path="enrollment" element={<EnrollmentPage />} />
              <Route path="school-fees" element={<SchoolFeesPage />} />
              <Route path="fees" element={<FeeOverviewPage />} />
              <Route path="news" element={<NewsPage />} />
              <Route path="gallery" element={<GalleryPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="audit" element={<AuditLogPage />} />
              <Route path="subjects" element={<SubjectsPage />} />
              <Route path="assessments" element={<AssessmentsPage />} />
              <Route path="broadcast" element={<BroadcastPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            {/* Finance routes */}
            <Route path="/finance" element={<ProtectedRoute allowedRoles={['finance', 'admin']}><FinanceLayout /></ProtectedRoute>}>
              <Route index element={<FinanceDashboard />} />
              <Route path="record-payment" element={<RecordPaymentPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="reports" element={<FinanceReportsPage />} />
            </Route>

            {/* Teacher routes */}
            <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><TeacherLayout /></ProtectedRoute>}>
              <Route index element={<TeacherDashboard />} />
              <Route path="results" element={<ResultsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="assignments" element={<AssignmentsPage />} />
              <Route path="timetable" element={<TeacherTimetablePage />} />
              <Route path="calendar" element={<CalendarViewPage />} />
              <Route path="notify" element={<TeacherNotifyPage />} />
            </Route>

            {/* Parent routes */}
            <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentLayout /></ProtectedRoute>}>
              <Route index element={<ParentDashboard />} />
              <Route path="fees" element={<ParentFeesPage />} />
              <Route path="results" element={<ParentResultsPage />} />
              <Route path="news" element={<ParentNewsPage />} />
              <Route path="gallery" element={<ParentGalleryPage />} />
              <Route path="notifications" element={<ParentNotificationsPage />} />
              <Route path="calendar" element={<CalendarViewPage />} />
              <Route path="whatsapp-sim" element={<WhatsAppSimPage />} />
            </Route>

            {/* Student routes */}
            <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentLayout /></ProtectedRoute>}>
              <Route index element={<StudentDashboard />} />
              <Route path="results" element={<StudentResultsPage />} />
              <Route path="fees" element={<StudentFeesPage />} />
              <Route path="assignments" element={<StudentAssignmentsPage />} />
              <Route path="timetable" element={<StudentTimetablePage />} />
              <Route path="calendar" element={<CalendarViewPage />} />
              <Route path="news" element={<StudentNewsPage />} />
              <Route path="gallery" element={<StudentGalleryPage />} />
              <Route path="notifications" element={<StudentNotificationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </DeleteKeyProvider>
        </OfflineProvider>
        </FeatureFlagsProvider>
      </AuthProvider>
    </Router>
  )
}
