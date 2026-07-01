import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import { generateFeeReport } from '../../utils/pdfGenerator'
import FeatureGate from '../../components/FeatureGate'

function toCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0]).join(',')
  return [headers, ...rows.map((r) => Object.values(r).join(','))].join('\n')
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function FinanceReportsPage() {
  const [payments, setPayments] = useState([])

  useEffect(() => {
    return onValue(ref(db, 'ssmms/payments'), (snap) => {
      const list = []
      snap.forEach((sn) => { sn.forEach((p) => { list.push({ key: p.key, ...p.val() }) }) })
      setPayments(list)
    })
  }, [])

  const total = payments.reduce((a, p) => a + Number(p.amount || 0), 0)

  const byType = payments.reduce((acc, p) => {
    const t = p.paymentType || 'Other'
    acc[t] = (acc[t] || 0) + Number(p.amount || 0)
    return acc
  }, {})

  const rows = Object.entries(byType).map(([Type, Amount]) => ({ Type, 'Amount ($)': Amount.toFixed(2) }))

  const exportPDF = () => {
    if (!rows.length) return
    generateFeeReport(rows, 'Finance Report').save(`SSMMS_Finance_Report_${Date.now()}.pdf`)
  }

  const exportCSV = () => downloadCSV(toCSV(rows), `SSMMS_Finance_${Date.now()}.csv`)

  return (
    <FeatureGate flag="reportsAnalytics">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-4">Financial Reports</h2>

        <div className="bg-[#0D3B66] text-white rounded-xl p-5 shadow mb-6">
          <p className="text-sm opacity-80">Total Collected (all time)</p>
          <p className="text-3xl font-bold">${total.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold text-slate-700">Collections by Payment Type</h3>
            <div className="flex gap-2">
              <button onClick={exportPDF} className="text-xs bg-[#0D3B66] text-white px-3 py-1.5 rounded hover:bg-[#0a2f52]">PDF</button>
              <button onClick={exportCSV} className="text-xs bg-slate-600 text-white px-3 py-1.5 rounded hover:bg-slate-700">CSV</button>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {rows.map((r) => (
              <div key={r.Type} className="bg-slate-50 rounded-lg p-4 min-w-32">
                <p className="text-xl font-bold text-[#0D3B66]">${r['Amount ($)']}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.Type}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FeatureGate>
  )
}
