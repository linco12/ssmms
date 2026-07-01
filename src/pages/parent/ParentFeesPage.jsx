import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { generateReceipt } from '../../utils/pdfGenerator'
import FeatureGate from '../../components/FeatureGate'

export default function ParentFeesPage() {
  const { currentUser } = useAuth()
  const [student, setStudent] = useState(null)
  const [payments, setPayments] = useState([])

  useEffect(() => {
    if (!currentUser) return
    const q = query(ref(db, 'ssmms/students'), orderByChild('linkedParentUid'), equalTo(currentUser.uid))
    return onValue(q, (snap) => {
      if (snap.exists()) {
        const entries = Object.entries(snap.val())
        const s = { key: entries[0][0], ...entries[0][1] }
        setStudent(s)
        onValue(ref(db, `ssmms/payments/${s.key}`), (pSnap) => {
          const list = []
          pSnap.forEach((p) => { list.push({ key: p.key, ...p.val() }) })
          list.sort((a, b) => new Date(b.date) - new Date(a.date))
          setPayments(list)
        })
      }
    })
  }, [currentUser])

  if (!student) return <p className="text-slate-400 text-sm">No student linked.</p>

  const downloadReceipt = (p) => {
    const doc = generateReceipt(student, p, student.feeBalance || 0)
    doc.save(`Receipt_${student.studentId}_${p.key}.pdf`)
  }

  return (
    <FeatureGate flag="feeManagement">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-4">Fees & Payments</h2>

        <div className={`rounded-xl p-5 text-white shadow mb-6 ${Number(student.feeBalance) > 0 ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <p className="text-sm opacity-80">Current Balance</p>
          <p className="text-3xl font-bold">${Number(student.feeBalance || 0).toFixed(2)}</p>
          {Number(student.feeBalance) > 0 && (
            <p className="text-xs opacity-80 mt-1">Please contact the school to arrange payment.</p>
          )}
        </div>

        <h3 className="font-semibold text-slate-700 mb-2">Payment History</h3>
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0D3B66] text-white">
              <tr>
                {['Date', 'Type', 'Amount', 'Receipt'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-400">No payments yet</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.key} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-400">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2">{p.paymentType}</td>
                  <td className="px-3 py-2 font-semibold text-emerald-600">${Number(p.amount || 0).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <FeatureGate flag="receiptGeneration">
                      <button onClick={() => downloadReceipt(p)} className="text-xs text-[#0D3B66] hover:underline">PDF</button>
                    </FeatureGate>
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
