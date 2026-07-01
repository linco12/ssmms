import { useEffect, useState } from 'react'
import { db, firebaseConfig } from '../../firebase/config'
import { ref, onValue, update, set, remove } from 'firebase/database'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'
import { FLAG_META, DEFAULTS } from '../../utils/featureFlags'

const ROLES = ['admin', 'finance', 'teacher', 'parent', 'student']
const ROLE_COLOR = {
  admin:   'bg-red-100 text-red-700',
  finance: 'bg-emerald-100 text-emerald-700',
  teacher: 'bg-blue-100 text-blue-700',
  parent:  'bg-violet-100 text-violet-700',
  student: 'bg-amber-100 text-amber-700',
}
const BLANK = { displayName: '', email: '', password: '', confirmPassword: '', role: 'teacher', qualification: '', schoolId: '' }

function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === 'register-secondary')
  const app = existing || initializeApp(firebaseConfig, 'register-secondary')
  return getAuth(app)
}

export default function UsersPage() {
  const { currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [updating, setUpdating] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [privModal, setPrivModal] = useState(null) // { user }
  const [privData,  setPrivData]  = useState({})   // current userPrivileges for selected user

  useEffect(() => {
    return onValue(ref(db, 'ssmms/users'), (snap) => {
      const list = []
      snap.forEach((child) => { list.push({ uid: child.key, ...child.val() }) })
      list.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
      setUsers(list)
    })
  }, [])

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const q = search.toLowerCase()
    const matchSearch = !q || u.email?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  const openModal = () => { setForm(BLANK); setError(''); setSuccess(''); setModal(true); setShowPass(false) }

  const handleRegister = async () => {
    setError('')
    if (!form.displayName.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    if ((form.role === 'teacher' || form.role === 'student') && !form.schoolId.trim()) {
      setError(`${form.role === 'teacher' ? 'Staff ID' : 'Student ID'} is required.`); return
    }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }

    setSaving(true)
    try {
      const secAuth = getSecondaryAuth()
      const cred = await createUserWithEmailAndPassword(secAuth, form.email.trim(), form.password)
      await updateProfile(cred.user, { displayName: form.displayName.trim() })

      const profile = {
        role: form.role,
        displayName: form.displayName.trim(),
        email: form.email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
      }
      if (form.schoolId.trim()) profile.schoolId = form.schoolId.trim().toUpperCase()
      if (form.role === 'teacher' && form.qualification.trim()) {
        profile.qualification = form.qualification.trim()
      }
      await set(ref(db, `ssmms/users/${cred.user.uid}`), profile)
      await signOut(secAuth)
      await logAction(currentUser, 'CREATE', 'user', { email: form.email, role: form.role })
      setSuccess(`Account created for ${form.displayName.trim()} (${form.role})`)
      setForm(BLANK)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('That email address is already registered.')
      else if (err.code === 'auth/invalid-email') setError('Invalid email address.')
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const changeRole = async (user, newRole) => {
    setUpdating(user.uid)
    await update(ref(db, `ssmms/users/${user.uid}`), { role: newRole })
    await logAction(currentUser, 'ROLE_CHANGE', 'user', { uid: user.uid, email: user.email, from: user.role, to: newRole })
    setUpdating(null)
  }

  const toggleDev = async (user) => {
    await update(ref(db, `ssmms/users/${user.uid}`), { isDeveloper: !user.isDeveloper })
  }

  const openPrivModal = (user) => {
    setPrivModal(user)
    // Load current privileges for this user
    onValue(ref(db, `ssmms/userPrivileges/${user.uid}`), snap => {
      setPrivData(snap.val() || {})
    }, { onlyOnce: true })
  }

  const togglePriv = async (flagKey, currentValue) => {
    if (!privModal) return
    const uid = privModal.uid
    if (currentValue === null) {
      // No override → set to ON (explicit)
      await set(ref(db, `ssmms/userPrivileges/${uid}/${flagKey}`), true)
    } else if (currentValue === true) {
      // ON → OFF
      await set(ref(db, `ssmms/userPrivileges/${uid}/${flagKey}`), false)
    } else {
      // OFF → remove override (inherit global)
      await remove(ref(db, `ssmms/userPrivileges/${uid}/${flagKey}`))
    }
    // Reload
    const snap = await (await import('firebase/database')).get(ref(db, `ssmms/userPrivileges/${uid}`))
    setPrivData(snap.val() || {})
  }

  // Flags relevant by role
  const ROLE_FLAG_GROUPS = {
    teacher:  ['Teacher Privileges', 'Teacher Navigation', 'Features'],
    admin:    ['Admin Navigation', 'Features'],
    parent:   ['Parent Navigation', 'Features'],
    student:  ['Student Navigation', 'Features'],
    finance:  ['Features'],
  }

  const counts = { all: users.length }
  ROLES.forEach(r => { counts[r] = users.filter(u => u.role === r).length })

  const ROLE_HINT = {
    teacher:  'Teacher accounts can enter marks, take attendance, and view their assigned classes.',
    finance:  'Finance accounts can record payments, view all fees, and generate financial reports.',
    parent:   'Parent accounts must be linked to a student through the Students page after creation.',
    student:  'Student accounts must be linked to a student record through the Students page after creation.',
    admin:    'Admin accounts have full access to all system features.',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#0D3B66]">User Accounts</h2>
          <p className="text-sm text-slate-400">{users.length} total accounts across all roles</p>
        </div>
        <button onClick={openModal}
          className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52]">
          + Register Account
        </button>
      </div>

      {/* Role filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[['all', 'All'], ...ROLES.map(r => [r, r.charAt(0).toUpperCase() + r.slice(1)])].map(([val, label]) => (
          <button key={val} onClick={() => setRoleFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${roleFilter === val ? 'bg-[#0D3B66] text-white border-[#0D3B66]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#0D3B66]'}`}>
            {label} ({counts[val] || 0})
          </button>
        ))}
      </div>

      <input type="text" placeholder="Search by name or email…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0D3B66] text-white">
            <tr>
              {['Name', 'School ID', 'Email', 'Role', 'Dev', 'Privileges', 'Last Login', 'UID'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.uid} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{u.displayName || '—'}</td>
                <td className="px-3 py-2 text-xs font-mono text-slate-500">{u.schoolId || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{u.email || '—'}</td>
                <td className="px-3 py-2">
                  <select disabled={updating === u.uid} value={u.role || ''}
                    onChange={e => changeRole(u, e.target.value)}
                    className={`border rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0D3B66] ${ROLE_COLOR[u.role] || 'bg-slate-100 text-slate-600'} border-transparent`}>
                    <option value="">— unset —</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleDev(u)}
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.isDeveloper ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-400'}`}>
                    {u.isDeveloper ? 'Dev' : '—'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => openPrivModal(u)}
                    className="text-xs px-2 py-1 rounded-lg bg-[#0D3B66]/10 text-[#0D3B66] hover:bg-[#0D3B66]/20 font-semibold">
                    🛡 Manage
                  </button>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-GB') : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-400 font-mono">{u.uid?.slice(0, 8)}…</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400 text-sm">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Privileges Modal ──────────────────────────────── */}
      {privModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#0D3B66]">🛡 Privileges</h3>
                <p className="text-xs text-slate-400">{privModal.displayName} · {privModal.role}</p>
              </div>
              <button onClick={() => setPrivModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 mb-5">
              Each toggle has 3 states: <strong>Inherit</strong> (follows global setting) → <strong>ON</strong> (always enabled for this user) → <strong>OFF</strong> (always hidden for this user).
            </div>

            {(ROLE_FLAG_GROUPS[privModal.role] || ['Features']).map(group => {
              const groupFlags = Object.entries(FLAG_META).filter(([, m]) => m.group === group)
              if (groupFlags.length === 0) return null
              return (
                <div key={group} className="mb-5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{group}</div>
                  <div className="space-y-1">
                    {groupFlags.map(([key, meta]) => {
                      const override = key in privData ? privData[key] : null
                      const globalVal = DEFAULTS[key] ?? true
                      return (
                        <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                          <div className="flex-1 pr-3">
                            <div className="text-sm font-medium text-slate-700">{meta.label}</div>
                            <div className="text-xs text-slate-400">{meta.desc}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-slate-400">
                              {override === null
                                ? `Inherit (global: ${globalVal ? 'ON' : 'OFF'})`
                                : override ? 'Override: ON' : 'Override: OFF'}
                            </span>
                            <button onClick={() => togglePriv(key, override)}
                              className={`w-12 h-6 rounded-full transition-colors relative ${
                                override === null ? 'bg-slate-200'
                                : override ? 'bg-emerald-500' : 'bg-red-400'
                              }`}>
                              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                override === null ? 'left-0.5'
                                : override ? 'left-6' : 'left-3.5'
                              }`} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className="flex justify-end mt-4">
              <button onClick={() => setPrivModal(null)}
                className="px-5 py-2 bg-[#0D3B66] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2f52]">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Register Account Modal ─────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-[#0D3B66] mb-1">Register New Account</h3>
            <p className="text-xs text-slate-400 mb-5">Creates a Firebase Auth login and sets up the user profile in the database.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm mb-4">{error}</div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2.5 text-sm mb-4">✓ {success}</div>
            )}

            <div className="space-y-4">
              {/* Role selector */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Role *</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${form.role === r ? 'bg-[#0D3B66] text-white border-[#0D3B66]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#0D3B66]'}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">{ROLE_HINT[form.role]}</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder={
                    form.role === 'teacher' ? 'e.g. Mr John Moyo' :
                    form.role === 'parent'  ? 'e.g. Mrs Grace Dube' :
                    form.role === 'student' ? 'e.g. Tafara Gumbo' : 'Full name'
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder={
                    form.role === 'teacher'  ? 'teacher5@ssmms.edu' :
                    form.role === 'finance'  ? 'finance2@ssmms.edu' :
                    form.role === 'parent'   ? 'parent.surname@ssmms.edu' :
                    form.role === 'student'  ? 'student.firstname.lastname@ssmms.edu' :
                    'admin2@ssmms.edu'
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>

              {/* School ID */}
              {(form.role === 'teacher' || form.role === 'student') && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {form.role === 'teacher' ? 'Staff / Employee ID *' : 'Student ID *'}
                  </label>
                  <input
                    value={form.schoolId}
                    onChange={e => setForm(f => ({ ...f, schoolId: e.target.value }))}
                    placeholder={form.role === 'teacher' ? 'e.g. TCH-001' : 'e.g. STU-MOY045'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] font-mono tracking-wide"
                  />
                  <p className="text-xs text-slate-400 mt-1">Stored in uppercase. This is the ID printed on the school card.</p>
                </div>
              )}

              {/* Teacher qualification */}
              {form.role === 'teacher' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Qualification</label>
                  <input value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}
                    placeholder="e.g. B.Ed Mathematics, UZ 2018"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Minimum 6 characters"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600">{showPass ? 'Hide' : 'Show'}</button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirm Password *</label>
                <input type={showPass ? 'text' : 'password'} value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Re-enter password"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button onClick={() => { setModal(false); setSuccess('') }} disabled={saving}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                {success ? 'Close' : 'Cancel'}
              </button>
              {success ? (
                <button onClick={() => { setForm(BLANK); setSuccess(''); setError('') }}
                  className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold">
                  + Register Another
                </button>
              ) : (
                <button onClick={handleRegister}
                  disabled={saving || !form.displayName || !form.email || form.password.length < 6 || form.password !== form.confirmPassword || ((['teacher','student'].includes(form.role)) && !form.schoolId.trim())}
                  className="px-5 py-2 text-sm bg-[#0D3B66] text-white rounded-lg hover:bg-[#0a2f52] disabled:opacity-60 font-semibold min-w-28">
                  {saving ? 'Creating…' : 'Create Account'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
