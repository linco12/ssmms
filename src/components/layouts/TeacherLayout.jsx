import { NavLink } from 'react-router-dom'
import { useFeatureFlags } from '../../context/FeatureFlagsContext'
import AppShell from './AppShell'

const NAV = [
  { to: '/teacher',              label: 'Dashboard',      icon: '🏠', end: true },
  { to: '/teacher/results',      label: 'Results & Grades', icon: '📊', flag: 'nav_teacher_results' },
  { to: '/teacher/attendance',   label: 'Attendance',     icon: '✅',  flag: 'nav_teacher_attendance' },
  { to: '/teacher/assignments',  label: 'Assignments',    icon: '📝',  flag: 'nav_teacher_assignments' },
  { to: '/teacher/timetable',    label: 'Timetable',      icon: '🕐',  flag: 'nav_teacher_timetable' },
  { to: '/teacher/calendar',     label: 'Calendar',       icon: '📅',  flag: 'nav_teacher_calendar' },
  { to: '/teacher/notify',       label: 'Notify',         icon: '🔔',  flag: 'nav_teacher_notify' },
]

export default function TeacherLayout() {
  const { isEnabled } = useFeatureFlags()
  const nav = NAV.filter(item => !item.flag || isEnabled(item.flag))

  const extra = <NavLink to="/profile" className="nav-link text-xs hidden md:inline">Profile</NavLink>
  return <AppShell nav={nav} role="teacher" maxWidth="max-w-7xl" extraActions={extra} />
}
