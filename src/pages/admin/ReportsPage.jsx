import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import FeatureGate from '../../components/FeatureGate'
import { generateFeeReport } from '../../utils/pdfGenerator'

function toCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0]).join(',')
  const lines = rows.map((r) => Object.values(r).map(String).join(','))
  return [headers, ...lines].join('\n')
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState([])

  useEffect(() => {
    const u1 = onValue(ref(db, 'ssmms/students'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      setStudents(list)
    })
    const u2 = onValue(ref(db, 'ssmms/payments'), (snap) => {
      const list = []
      snap.forEach((c) => {
        snap.child(c.key).forEach((p) => { list.push({ studentKey: c.key, id: p.key, ...p.val() }) })
      })
      setPayments(list)
    })
    return () => { u1(); u2() }
  }, [])

  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
  const totalOutstanding = students.reduce((acc, s) => acc + Number(s.feeBalance || 0), 0)

  const byClass = students.reduce((acc, s) => {
    const cls = s.classGrade || 'Unknown'
    if (!acc[cls]) acc[cls] = { class: cls, students: 0, outstanding: 0 }
    acc[cls].students++
    acc[cls].outstanding += Number(s.feeBalance || 0)
    return acc
  }, {})

  const classRows = Object.values(byClass).map((r) => ({
    Class: r.class,
    Students: r.students,
    'Outstanding ($)': r.outstanding.toFixed(2),
  }))

  const enrollRows = [
    { Status: 'Active', Count: students.filter((s) => s.enrollmentStatus === 'Active').length },
    { Status: 'Suspended', Count: students.filter((s) => s.enrollmentStatus === 'Suspended').length },
    { Status: 'Withdrawn', Count: students.filter((s) => s.enrollmentStatus === 'Withdrawn').length },
  ]

  const exportFeePDF = () => {
    if (!classRows.length) return
    const doc = generateFeeReport(classRows, 'Fee Collection Report')
    doc.save(`SSMMS_Fee_Report_${Date.now()}.pdf`)
  }

  const exportFeeCSV = () => downloadCSV(toCSV(classRows), `SSMMS_Fees_${Date.now()}.csv`)
  const exportEnrollCSV = () => downloadCSV(toCSV(enrollRows), `SSMMS_Enrollment_${Date.now()}.csv`)

  return (
    <FeatureGate flag="reportsAnalytics">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-4">Reports & Analytics</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0D3B66] text-white rounded-xl p-4 shadow">
            <p className="text-xs opacity-80">Total Collected (all time)</p>
            <p className="text-2xl font-bold">${totalCollected.toFixed(2)}</p>
          </div>
          <div className="bg-amber-500 text-white rounded-xl p-4 shadow">
            <p className="text-xs opacity-80">Total Outstanding</p>
            <p className="text-2xl font-bold">${totalOutstanding.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 mb-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold text-slate-700">Fee Summary by Class</h3>
            <div className="flex gap-2">
              <button onClick={exportFeePDF} className="text-xs bg-[#0D3B66] text-white px-3 py-1.5 rounded hover:bg-[#0a2f52]">PDF</button>
              <button onClick={exportFeeCSV} className="text-xs bg-slate-600 text-white px-3 py-1.5 rounded hover:bg-slate-700">CSV</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>{['Class', 'Students', 'Outstanding ($)'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {classRows.map((r) => (
                <tr key={r.Class} className="border-t">
                  <td className="px-3 py-2">{r.Class}</td>
                  <td className="px-3 py-2">{r.Students}</td>
                  <td className="px-3 py-2 font-semibold text-red-600">${r['Outstanding ($)']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold text-slate-700">Enrollment Overview</h3>
            <button onClick={exportEnrollCSV} className="text-xs bg-slate-600 text-white px-3 py-1.5 rounded hover:bg-slate-700">CSV</button>
          </div>
          <div className="flex gap-4 flex-wrap">
            {enrollRows.map((r) => (
              <div key={r.Status} className="bg-slate-50 rounded-lg p-4 text-center min-w-24">
                <p className="text-2xl font-bold text-[#0D3B66]">{r.Count}</p>
                <p className="text-xs text-slate-500">{r.Status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FeatureGate>
  )
}
