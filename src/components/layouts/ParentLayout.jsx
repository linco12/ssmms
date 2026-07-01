import { NavLink } from 'react-router-dom'
import { useFeatureFlags } from '../../context/FeatureFlagsContext'
import AppShell from './AppShell'

const NAV = [
  { to: '/parent',               label: 'My Child',      icon: '👶', end: true },
  { to: '/parent/results',       label: 'Results',       icon: '📊', flag: 'nav_parent_results' },
  { to: '/parent/fees',          label: 'Fees',          icon: '💰', flag: 'nav_parent_fees' },
  { to: '/parent/news',          label: 'News',          icon: '📰', flag: 'nav_parent_news' },
  { to: '/parent/gallery',       label: 'Gallery',       icon: '🖼️', flag: 'nav_parent_gallery' },
  { to: '/parent/notifications', label: 'Notifications', icon: '🔔', flag: 'nav_parent_notifications' },
  { to: '/parent/calendar',      label: 'Calendar',      icon: '📅', flag: 'nav_parent_calendar' },
  { to: '/parent/whatsapp-sim',  label: 'WA Sim',        icon: '💬', flag: 'nav_parent_whatsapp' },
]

export default function ParentLayout() {
  const { isEnabled } = useFeatureFlags()
  const nav = NAV.filter(item => !item.flag || isEnabled(item.flag))

  const extra = <NavLink to="/profile" className="nav-link text-xs hidden md:inline">Profile</NavLink>
  return <AppShell nav={nav} role="parent" maxWidth="max-w-7xl" extraActions={extra} />
}
