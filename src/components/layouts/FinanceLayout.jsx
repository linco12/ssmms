import { NavLink } from 'react-router-dom'
import AppShell from './AppShell'

const NAV = [
  { to: '/finance',                  label: 'Dashboard',      icon: '🏠', end: true },
  { to: '/finance/record-payment',   label: 'Record Payment', icon: '💳' },
  { to: '/finance/transactions',     label: 'Transactions',   icon: '📋' },
  { to: '/finance/reports',          label: 'Reports',        icon: '📊' },
]

export default function FinanceLayout() {
  const extra = <NavLink to="/profile" className="nav-link text-xs hidden md:inline">Profile</NavLink>
  return <AppShell nav={NAV} role="finance" maxWidth="max-w-7xl" extraActions={extra} />
}
