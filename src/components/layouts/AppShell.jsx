import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ROLE_BADGE = {
  admin:   'bg-blue-800',
  student: 'bg-blue-800',
  teacher: 'bg-violet-700',
  parent:  'bg-sky-700',
  finance: 'bg-emerald-700',
}

export default function AppShell({ nav, role, maxWidth = 'max-w-7xl', extraActions }) {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  // Close drawer on route change (user tapped a link)
  useEffect(() => { setOpen(false) }, [location.pathname])

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  const badge = ROLE_BADGE[role] || 'bg-blue-800'

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <nav className="bg-[#0D3B66] text-white px-4 py-3 flex items-center gap-3 shadow sticky top-0 z-30">

        {/* Hamburger — mobile only */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1 shrink-0"
          onClick={() => setOpen(o => !o)}
          aria-label="Open menu"
        >
          <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>

        <span className="font-bold text-lg tracking-wide shrink-0">SSMMS</span>
        <span className={`text-xs ${badge} rounded px-2 py-0.5 uppercase tracking-widest shrink-0`}>
          {role}
        </span>

        {/* Desktop nav links */}
        <div className="hidden md:flex flex-wrap gap-1 flex-1">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          {extraActions}
          <span className="hidden md:inline text-xs text-blue-200 max-w-[120px] truncate">
            {userProfile?.displayName}
          </span>
          <button onClick={handleLogout}
            className="hidden md:inline text-xs text-slate-300 hover:text-white underline">
            Logout
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer overlay ────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ──────────────────────────────────────────── */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-[#0D3B66] text-white z-50 flex flex-col
        transition-transform duration-250 ease-in-out md:hidden
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-700">
          <div>
            <p className="font-bold text-lg leading-none">SSMMS</p>
            <p className={`text-xs mt-1 ${badge} inline-block rounded px-2 py-0.5 uppercase tracking-widest`}>
              {role}
            </p>
          </div>
          <button onClick={() => setOpen(false)} className="text-blue-200 hover:text-white text-2xl leading-none p-1">✕</button>
        </div>

        {/* User name */}
        <div className="px-5 py-3 border-b border-blue-700">
          <p className="text-xs text-blue-300">Signed in as</p>
          <p className="text-sm font-medium truncate">{userProfile?.displayName || userProfile?.email}</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-2">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center px-5 py-3 text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-white/20 text-white border-l-4 border-white'
                   : 'text-blue-100 hover:bg-white/10 hover:text-white border-l-4 border-transparent'
                 }`
              }>
              {n.icon && <span className="mr-3 text-base">{n.icon}</span>}
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Drawer footer */}
        <div className="px-5 py-4 border-t border-blue-700 space-y-2">
          {extraActions && <div className="pb-1">{extraActions}</div>}
          <button onClick={handleLogout}
            className="w-full text-sm text-left text-blue-200 hover:text-white py-1">
            ⏻ Logout
          </button>
        </div>
      </aside>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className={`flex-1 p-4 md:p-6 ${maxWidth} mx-auto w-full`}>
        <Outlet />
      </main>
    </div>
  )
}
