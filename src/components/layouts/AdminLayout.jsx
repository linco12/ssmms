import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useFeatureFlags } from '../../context/FeatureFlagsContext'
import AppShell from './AppShell'

const NAV = [
  { to: '/admin',              label: 'Dashboard',   icon: '🏠', end: true },
  { to: '/admin/students',     label: 'Students',    icon: '🎓', flag: 'nav_admin_students' },
  { to: '/admin/classes',      label: 'Classes',     icon: '🏫', flag: 'nav_admin_classes' },
  { to: '/admin/promote',      label: 'Promote',     icon: '📈', flag: 'nav_admin_promote' },
  { to: '/admin/school-fees',  label: 'Fees',        icon: '💰', flag: 'nav_admin_fees' },
  { to: '/admin/enrollment',   label: 'Enrollment',  icon: '📋', flag: 'nav_admin_enrollment' },
  { to: '/admin/calendar',     label: 'Calendar',    icon: '📅', flag: 'nav_admin_calendar' },
  { to: '/admin/timetable',    label: 'Timetable',   icon: '🕐', flag: 'nav_admin_timetable' },
  { to: '/admin/news',         label: 'News',        icon: '📰', flag: 'nav_admin_news' },
  { to: '/admin/gallery',      label: 'Gallery',     icon: '🖼️', flag: 'nav_admin_gallery' },
  { to: '/admin/subjects',     label: 'Subjects',    icon: '📚', flag: 'nav_admin_subjects' },
  { to: '/admin/assessments',  label: 'Assessments', icon: '✏️', flag: 'nav_admin_assessments' },
  { to: '/admin/reports',      label: 'Reports',     icon: '📊', flag: 'nav_admin_reports' },
  { to: '/admin/audit',        label: 'Audit Log',   icon: '🔍', flag: 'nav_admin_audit' },
  { to: '/admin/broadcast',    label: 'Broadcast',   icon: '📢', flag: 'nav_admin_broadcast' },
  { to: '/admin/users',        label: 'Users',       icon: '👥', flag: 'nav_admin_users' },
  { to: '/admin/settings',     label: 'Settings',    icon: '⚙️' },
]

export default function AdminLayout() {
  const { userProfile } = useAuth()
  const { isEnabled } = useFeatureFlags()

  const nav = NAV.filter(item => !item.flag || isEnabled(item.flag))

  const extra = (
    <>
      <NavLink to="/profile" className="nav-link text-xs hidden md:inline">Profile</NavLink>
      {userProfile?.isDeveloper && (
        <NavLink to="/dev-settings" className="nav-link text-xs bg-yellow-600 hover:bg-yellow-500 rounded px-2 hidden md:inline">Dev</NavLink>
      )}
    </>
  )

  return <AppShell nav={nav} role="admin" maxWidth="max-w-7xl" extraActions={extra} />
}
