import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, update } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'
import FeatureGate from '../../components/FeatureGate'

const STATUS_OPTIONS = ['Active', 'Suspended', 'Withdrawn']

export default function EnrollmentPage() {
  const { currentUser } = useAuth()
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    return onValue(ref(db, 'students'), (snap) => {
      const list = []
      snap.forEach((child) => { list.push({ key: child.key, ...child.val() }) })
      setStudents(list)
    })
  }, [])

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'All' || s.enrollmentStatus === filter
    return matchesSearch && matchesFilter
  })

  const changeStatus = async (student, newStatus) => {
    setUpdating(student.key)
    await update(ref(db, `students/${student.key}`), {
      enrollmentStatus: newStatus,
      statusUpdatedAt: new Date().toISOString(),
    })
    await logAction(currentUser, 'STATUS_CHANGE', 'student', {
      studentId: student.studentId,
      name: student.fullName,
      from: student.enrollmentStatus,
      to: newStatus,
    })
    setUpdating(null)
  }

  return (
    <FeatureGate flag="enrollmentTracking">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-4">Enrollment Tracking</h2>

        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
          />
          <div className="flex gap-1">
            {['All', ...STATUS_OPTIONS].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === s ? 'bg-[#0D3B66] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0D3B66] text-white">
              <tr>
                {['Student ID', 'Name', 'Class', 'Current Status', 'Last Updated', 'Change Status'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No students</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.key} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{s.studentId}</td>
                  <td className="px-3 py-2 font-medium">{s.fullName}</td>
                  <td className="px-3 py-2">{s.classGrade}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      s.enrollmentStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                      s.enrollmentStatus === 'Suspended' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{s.enrollmentStatus || 'Active'}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-xs">
                    {s.statusUpdatedAt ? new Date(s.statusUpdatedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      disabled={updating === s.key}
                      value={s.enrollmentStatus || 'Active'}
                      onChange={(e) => changeStatus(s, e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
                    >
                      {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </FeatureGate>
  )
}
