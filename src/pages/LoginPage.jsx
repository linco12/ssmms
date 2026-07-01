import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_HOME = {
  admin: '/admin',
  finance: '/finance',
  teacher: '/teacher',
  parent: '/parent',
}

export default function LoginPage() {
  const { login, userProfile } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cred = await login(email, password)
      // userProfile may not be loaded yet — fetch role from DB via AuthContext re-render
      // The AuthContext onAuthStateChanged will update, routing will happen below
    } catch (err) {
      setError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Once userProfile loads after login, navigate to role home
  if (userProfile?.role) {
    const dest = userProfile.isDeveloper ? '/admin' : (ROLE_HOME[userProfile.role] || '/login')
    navigate(dest, { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-[#0D3B66] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#0D3B66] font-sans tracking-tight">SSMMS</h1>
          <p className="text-slate-500 text-sm mt-1">Smart School Management & Monitoring System</p>
          <p className="text-slate-400 text-xs mt-0.5">TronicVolt Autonetics Investments</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] focus:border-transparent"
              placeholder="you@school.edu"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0D3B66] text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-[#0a2f52] transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Your role is automatically detected after login.
        </p>
      </div>
    </div>
  )
}
