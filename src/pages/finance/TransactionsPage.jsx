import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import { generateReceipt, generatePaymentHistory } from '../../utils/pdfGenerator'
import FeatureGate from '../../components/FeatureGate'

function openPdf(doc) {
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}

export default function TransactionsPage() {
  const [payments, setPayments] = useState([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [expandedKey, setExpandedKey] = useState(null)

  useEffect(() => {
    return onValue(ref(db, 'payments'), (snap) => {
      const list = []
      snap.forEach((studentNode) => {
        studentNode.forEach((p) => { list.push({ key: p.key, studentKey: studentNode.key, ...p.val() }) })
      })
      list.sort((a, b) => new Date(b.date) - new Date(a.date))
      setPayments(list)
    })
  }, [])

  const allTypes = ['All', ...new Set(payments.map(p => p.paymentType).filter(Boolean))]

  const filtered = payments.filter(p => {
    const matchSearch =
      p.studentName?.toLowerCase().includes(search.toLowerCase()) ||
      p.studentId?.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'All' || p.paymentType === typeFilter
    return matchSearch && matchType
  })

  // Group by student
  const studentMap = {}
  filtered.forEach(p => {
    const k = p.studentKey
    if (!studentMap[k]) {
      studentMap[k] = { studentKey: k, studentName: p.studentName, studentId: p.studentId, classGrade: p.classGrade, payments: [] }
    }
    studentMap[k].payments.push(p)
  })
  const studentGroups = Object.values(studentMap).sort((a, b) =>
    (a.studentName || '').localeCompare(b.studentName || '')
  )

  const grandTotal = filtered.reduce((s, p) => s + Number(p.amount || 0), 0)

  const printStudentHistory = (grp) => {
    const doc = generatePaymentHistory(grp.studentName, grp.studentId, grp.classGrade, grp.payments)
    openPdf(doc)
  }

  const printReceipt = (p) => {
    const doc = generateReceipt(
      { fullName: p.studentName, studentId: p.studentId, classGrade: p.classGrade || '—', guardianName: '—' },
      p, 0
    )
    openPdf(doc)
  }

  const downloadReceipt = (p) => {
    const doc = generateReceipt(
      { fullName: p.studentName, studentId: p.studentId, classGrade: p.classGrade || '—', guardianName: '—' },
      p, 0
    )
    doc.save(`Receipt_${p.studentId}_${p.key}.pdf`)
  }

  return (
    <FeatureGate flag="feeManagement">
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold text-[#0D3B66]">Payment History</h2>
            <p className="text-sm text-slate-400">
              {studentGroups.length} student{studentGroups.length !== 1 ? 's' : ''} · ${grandTotal.toFixed(2)} total collected
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Search by student name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
          >
            {allTypes.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Grouped student list */}
        {studentGroups.length === 0 && (
          <div className="bg-white rounded-xl shadow p-10 text-center text-slate-400">No payment records found.</div>
        )}

        <div className="space-y-3">
          {studentGroups.map(grp => {
            const studentTotal = grp.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
            const isOpen = expandedKey === grp.studentKey

            return (
              <div key={grp.studentKey} className="bg-white rounded-xl shadow overflow-hidden">
                {/* Student header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 select-none"
                  onClick={() => setExpandedKey(isOpen ? null : grp.studentKey)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{grp.studentName}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {grp.studentId}{grp.classGrade ? ` · ${grp.classGrade}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600">${studentTotal.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">{grp.payments.length} payment{grp.payments.length !== 1 ? 's' : ''}</p>
                  </div>
                  <FeatureGate flag="receiptGeneration">
                    <button
                      onClick={e => { e.stopPropagation(); printStudentHistory(grp) }}
                      className="shrink-0 text-xs bg-[#0D3B66] text-white px-3 py-1.5 rounded hover:bg-[#0a2f52]"
                    >
                      Print History
                    </button>
                  </FeatureGate>
                  <span className="text-slate-400 shrink-0 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Payment rows */}
                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {['Date', 'Type', 'Amount', 'Notes', 'Recorded By', ''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...grp.payments].sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => (
                          <tr key={p.key} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                              {p.date
                                ? new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-xs">{p.paymentType}</td>
                            <td className="px-3 py-2 font-semibold text-emerald-600 whitespace-nowrap">
                              ${Number(p.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-400 max-w-xs truncate">{p.notes || '—'}</td>
                            <td className="px-3 py-2 text-xs text-slate-400">{p.recordedBy}</td>
                            <td className="px-3 py-2">
                              <FeatureGate flag="receiptGeneration">
                                <div className="flex gap-2">
                                  <button onClick={() => printReceipt(p)} className="text-xs text-[#0D3B66] hover:underline">
                                    Print
                                  </button>
                                  <button onClick={() => downloadReceipt(p)} className="text-xs text-slate-500 hover:underline">
                                    PDF
                                  </button>
                                </div>
                              </FeatureGate>
                            </td>
                          </tr>
                        ))}
                        {/* Subtotal row */}
                        <tr className="border-t-2 border-slate-200 bg-slate-50">
                          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-600">TOTAL PAID</td>
                          <td className="px-3 py-2 text-sm font-bold text-emerald-700">${studentTotal.toFixed(2)}</td>
                          <td colSpan={3} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </FeatureGate>
  )
}
