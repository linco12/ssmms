import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const QUICK_LINKS = [
  { to: '/admin/students', label: 'Students', icon: '👥', color: 'bg-indigo-500' },
  { to: '/admin/classes', label: 'Classes', icon: '🏫', color: 'bg-sky-500' },
  { to: '/admin/promote', label: 'Promote', icon: '🎓', color: 'bg-teal-500' },
  { to: '/admin/school-fees', label: 'School Fees', icon: '💳', color: 'bg-emerald-500' },
  { to: '/admin/news', label: 'News', icon: '📰', color: 'bg-amber-500' },
  { to: '/admin/gallery', label: 'Gallery', icon: '🖼️', color: 'bg-violet-500' },
  { to: '/admin/subjects', label: 'Subjects', icon: '📚', color: 'bg-blue-500' },
  { to: '/admin/assessments', label: 'Assessments', icon: '📝', color: 'bg-rose-500' },
  { to: '/admin/broadcast', label: 'Broadcast', icon: '📢', color: 'bg-orange-500' },
  { to: '/admin/users', label: 'Users', icon: '🔑', color: 'bg-slate-600' },
]

export default function AdminDashboard() {
  const { userProfile } = useAuth()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState(0)
  const [news, setNews] = useState([])
  const [teachers, setTeachers] = useState(0)
  const [auditLogs, setAuditLogs] = useState([])

  useEffect(() => {
    const uns = [
      onValue(ref(db, 'students'), snap => { const l = []; snap.forEach(c => { l.push({ key: c.key, ...c.val() }) }); setStudents(l) }),
      onValue(ref(db, 'classes'), snap => { const l = []; snap.forEach(c => { l.push({ key: c.key, ...c.val() }) }); setClasses(l) }),
      onValue(ref(db, 'subjects'), snap => setSubjects(snap.size || 0)),
      onValue(ref(db, 'news'), snap => { const l = []; snap.forEach(c => { l.push({ key: c.key, ...c.val() }) }); l.sort((a,b) => new Date(b.date) - new Date(a.date)); setNews(l.slice(0, 5)) }),
      onValue(ref(db, 'users'), snap => { let count = 0; snap.forEach(c => { if (c.val().role === 'teacher') count++ }); setTeachers(count) }),
      onValue(ref(db, 'auditLogs'), snap => { const l = []; snap.forEach(c => { l.push({ key: c.key, ...c.val() }) }); l.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)); setAuditLogs(l.slice(0, 8)) }),
    ]
    return () => uns.forEach(u => u())
  }, [])

  const active = students.filter(s => s.enrollmentStatus === 'Active').length
  const suspended = students.filter(s => s.enrollmentStatus === 'Suspended').length
  const totalOwing = students.reduce((t, s) => t + Math.max(0, Number(s.feeBalance || 0)), 0)
  const fullyPaid = students.filter(s => Number(s.feeBalance || 0) <= 0).length

  const formGroups = {}
  students.forEach(s => {
    const fm = (s.classGrade?.match(/\d+/) || ['?'])[0]
    formGroups[fm] = (formGroups[fm] || 0) + 1
  })

  const FORM_BG = { '1': 'bg-indigo-500', '2': 'bg-sky-500', '3': 'bg-teal-500', '4': 'bg-orange-500', '5': 'bg-violet-500', '6': 'bg-rose-500' }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[#0D3B66] to-[#1a5290] text-white rounded-2xl p-6 shadow-lg">
        <p className="text-sm opacity-80 mb-0.5">{greeting},</p>
        <h1 className="text-2xl font-bold mb-0.5">{userProfile?.displayName || 'Administrator'}</h1>
        <p className="text-sm opacity-70">TronicVolt Autonetics School — Management Dashboard</p>
        <p className="text-xs opacity-50 mt-2">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: students.length, sub: `${active} active`, bg: 'from-[#0D3B66] to-[#1a5290]' },
          { label: 'Active Classes', value: classes.length, sub: `${teachers} teachers`, bg: 'from-teal-500 to-teal-600' },
          { label: 'Fees Outstanding', value: `$${totalOwing.toFixed(0)}`, sub: `${fullyPaid} fully paid`, bg: 'from-red-500 to-red-600' },
          { label: 'ZIMSEC Subjects', value: subjects, sub: 'Across all forms', bg: 'from-violet-500 to-violet-600' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} text-white rounded-xl p-4 shadow-md`}>
            <p className="text-xs opacity-80 mb-0.5">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs opacity-70 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Enrolment by form */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-bold text-[#0D3B66] text-sm mb-3">Enrolment by Form</h3>
          <div className="space-y-2">
            {Object.entries(formGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([form, count]) => (
              <div key={form} className="flex items-center gap-2">
                <div className={`${FORM_BG[form] || 'bg-slate-400'} text-white text-xs font-bold rounded w-14 text-center py-0.5`}>Form {form}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`${FORM_BG[form] || 'bg-slate-400'} h-2 rounded-full`} style={{ width: `${(count / (students.length || 1)) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-600 w-6 text-right">{count}</span>
              </div>
            ))}
            {suspended > 0 && <p className="text-xs text-amber-600 mt-2">⚠ {suspended} suspended student{suspended > 1 ? 's' : ''}</p>}
          </div>
        </div>

        {/* Fee status overview */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-bold text-[#0D3B66] text-sm mb-3">Fee Status Overview</h3>
          {(() => {
            const paid = students.filter(s => Number(s.feeBalance||0) <= 0).length
            const partial = students.filter(s => Number(s.feeBalance||0) > 0 && Number(s.feeBalance||0) < (Number(s.termFee||0))).length
            const unpaid = students.filter(s => Number(s.feeBalance||0) >= (Number(s.termFee||0)) && Number(s.termFee||0) > 0).length
            const rows = [
              { label: 'Fully Paid', value: paid, color: 'bg-emerald-500' },
              { label: 'Partial', value: partial, color: 'bg-amber-400' },
              { label: 'Unpaid / Owing', value: unpaid, color: 'bg-red-500' },
            ]
            return (
              <div className="space-y-3">
                {rows.map(r => (
                  <div key={r.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600">{r.label}</span>
                      <span className="font-semibold">{r.value}</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2">
                      <div className={`${r.color} h-2 rounded-full`} style={{ width: `${(r.value / (students.length || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <Link to="/admin/school-fees" className="text-xs text-[#0D3B66] font-semibold hover:underline">Manage all fees →</Link>
              </div>
            )
          })()}
        </div>

        {/* Recent news */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[#0D3B66] text-sm">Recent News</h3>
            <Link to="/admin/news" className="text-xs text-[#0D3B66] hover:underline">Manage →</Link>
          </div>
          <div className="space-y-2">
            {news.length === 0 && <p className="text-xs text-slate-400">No news yet.</p>}
            {news.map(n => (
              <div key={n.key} className="border-l-2 border-[#0D3B66] pl-2 py-0.5">
                <p className="text-xs font-semibold text-slate-700 line-clamp-1">{n.title}</p>
                <p className="text-xs text-slate-400 capitalize">{n.type} · {n.date}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h3 className="font-bold text-[#0D3B66] mb-3 text-sm">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {QUICK_LINKS.map(l => (
            <Link key={l.to} to={l.to} className={`${l.color} text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow hover:opacity-90 transition-opacity`}>
              <span className="text-2xl">{l.icon}</span>
              <span className="text-xs font-semibold">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-bold text-[#0D3B66] text-sm mb-3">Recent Activity</h3>
        {auditLogs.length === 0 ? <p className="text-xs text-slate-400">No recent activity.</p> : (
          <div className="space-y-1.5">
            {auditLogs.map(log => (
              <div key={log.key} className="flex items-start gap-2 text-xs py-1.5 border-b border-slate-50 last:border-0">
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs ${log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' : log.action === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{log.action}</span>
                <span className="text-slate-600 flex-1">{log.targetType} — {log.details ? JSON.stringify(log.details).replace(/[{}""]/g, '').slice(0, 60) : ''}</span>
                <span className="text-slate-400 shrink-0">{log.timestamp ? new Date(log.timestamp).toLocaleString('en-GB', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit' }) : ''}</span>
              </div>
            ))}
            <Link to="/admin/audit" className="text-xs text-[#0D3B66] font-semibold hover:underline">View full audit log →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
