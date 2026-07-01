import { useFeatureFlags } from '../../context/FeatureFlagsContext'
import AppShell from './AppShell'

const NAV = [
  { to: '/student',               label: 'My Profile',    icon: '👤', end: true },
  { to: '/student/results',       label: 'My Results',    icon: '📊', flag: 'nav_student_results' },
  { to: '/student/fees',          label: 'My Fees',       icon: '💰', flag: 'nav_student_fees' },
  { to: '/student/assignments',   label: 'Assignments',   icon: '📝', flag: 'nav_student_assignments' },
  { to: '/student/timetable',     label: 'Timetable',     icon: '🕐', flag: 'nav_student_timetable' },
  { to: '/student/calendar',      label: 'Calendar',      icon: '📅', flag: 'nav_student_calendar' },
  { to: '/student/news',          label: 'News',          icon: '📰', flag: 'nav_student_news' },
  { to: '/student/gallery',       label: 'Gallery',       icon: '🖼️', flag: 'nav_student_gallery' },
  { to: '/student/notifications', label: 'Notifications', icon: '🔔', flag: 'nav_student_notifications' },
]

export default function StudentLayout() {
  const { isEnabled } = useFeatureFlags()
  const nav = NAV.filter(item => !item.flag || isEnabled(item.flag))
  return <AppShell nav={nav} role="student" maxWidth="max-w-4xl" />
}
