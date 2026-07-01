import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'

export default function StudentFeesPage() {
  const { userProfile } = useAuth()
  const [student, setStudent] = useState(null)
  const [payments, setPayments] = useState([])

  const studentKey = userProfile?.studentKey

  useEffect(() => {
    if (!studentKey) return
    const u1 = onValue(ref(db, `ssmms/students/${studentKey}`), (snap) => {
      if (snap.exists()) setStudent({ key: snap.key, ...snap.val() })
    })
    const u2 = onValue(
      query(ref(db, 'ssmms/payments'), orderByChild('studentKey'), equalTo(studentKey)),
      (snap) => {
        const list = []
        snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
        list.sort((a, b) => new Date(b.date) - new Date(a.date))
        setPayments(list)
      }
    )
    return () => { u1(); u2() }
  }, [studentKey])

  if (!studentKey) return (
    <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-6 text-sm">
      Student record not linked. Contact the administrator.
    </div>
  )

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-4">My Fees</h2>

      <div className={`rounded-xl shadow p-5 mb-6 ${Number(student?.feeBalance) > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Current Outstanding Balance</p>
        <p className={`text-4xl font-bold ${Number(student?.feeBalance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          ${Number(student?.feeBalance || 0).toFixed(2)}
        </p>
        {Number(student?.feeBalance) === 0 && (
          <p className="text-sm text-emerald-600 mt-1">Your fees are fully paid.</p>
        )}
      </div>

      <h3 className="font-semibold text-slate-700 mb-2">Payment History</h3>
      {payments.length === 0 ? (
        <p className="text-slate-400 text-sm">No payment records found.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0D3B66] text-white">
              <tr>
                {['Date', 'Amount', 'Type', 'Reference', 'Balance After'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.key} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-semibold text-emerald-600">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs">{p.paymentType}</td>
                  <td className="px-3 py-2 text-xs font-mono">{p.reference || '—'}</td>
                  <td className={`px-3 py-2 text-xs font-semibold ${Number(p.balanceAfter) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ${Number(p.balanceAfter || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
