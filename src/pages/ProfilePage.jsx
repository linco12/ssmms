import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const ROLE_HOME = { admin: '/admin', finance: '/finance', teacher: '/teacher', parent: '/parent' }

export default function ProfilePage() {
  const { currentUser, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = async () => { await logout(); navigate('/login') }

  const role = userProfile?.role || '—'
  const home = ROLE_HOME[role]

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          {home && (
            <button onClick={() => navigate(home)} className="text-[#0D3B66] text-sm hover:underline">← Back</button>
          )}
          <h1 className="text-2xl font-bold text-[#0D3B66]">My Profile</h1>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#0D3B66] flex items-center justify-center text-white text-2xl font-bold">
              {(currentUser?.displayName || currentUser?.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-lg text-slate-800">{currentUser?.displayName || 'No display name'}</p>
              <p className="text-sm text-slate-500">{currentUser?.email}</p>
            </div>
          </div>

          <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 font-medium">Role</p>
              <p className="capitalize font-semibold text-slate-700">{role}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Phone</p>
              <p className="font-semibold text-slate-700">{userProfile?.phone || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Last Login</p>
              <p className="font-semibold text-slate-700">
                {userProfile?.lastLogin
                  ? new Date(userProfile.lastLogin).toLocaleString()
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">UID</p>
              <p className="font-mono text-xs text-slate-500 truncate">{currentUser?.uid}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <button
              onClick={handleLogout}
              className="w-full bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
