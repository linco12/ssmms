import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import FeatureGate from '../../components/FeatureGate'

export default function FeeOverviewPage() {
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    return onValue(ref(db, 'ssmms/students'), (snap) => {
      const list = []
      snap.forEach((child) => { list.push({ key: child.key, ...child.val() }) })
      setStudents(list)
    })
  }, [])

  const filtered = students.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(search.toLowerCase())
  )

  const totalBalance = students.reduce((acc, s) => acc + Number(s.feeBalance || 0), 0)
  const overdue = students.filter((s) => Number(s.feeBalance || 0) > 0).length

  return (
    <FeatureGate flag="feeManagement">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-4">Fee Overview</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#0D3B66] text-white rounded-xl p-4 shadow">
            <p className="text-xs opacity-80">Total Outstanding</p>
            <p className="text-2xl font-bold">${totalBalance.toFixed(2)}</p>
          </div>
          <div className="bg-amber-500 text-white rounded-xl p-4 shadow">
            <p className="text-xs opacity-80">Students with Balance</p>
            <p className="text-2xl font-bold">{overdue}</p>
          </div>
          <div className="bg-emerald-600 text-white rounded-xl p-4 shadow">
            <p className="text-xs opacity-80">Cleared Accounts</p>
            <p className="text-2xl font-bold">{students.length - overdue}</p>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
        />

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0D3B66] text-white">
              <tr>
                {['Student ID', 'Name', 'Class', 'Status', 'Fee Balance'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.key} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{s.studentId}</td>
                  <td className="px-3 py-2 font-medium">{s.fullName}</td>
                  <td className="px-3 py-2">{s.classGrade}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      s.enrollmentStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{s.enrollmentStatus}</span>
                  </td>
                  <td className={`px-3 py-2 font-semibold ${Number(s.feeBalance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ${Number(s.feeBalance || 0).toFixed(2)}
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
