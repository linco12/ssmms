import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import { Link } from 'react-router-dom'

export default function FinanceDashboard() {
  const [stats, setStats] = useState({ payments: 0, total: 0, outstanding: 0 })

  useEffect(() => {
    const u1 = onValue(ref(db, 'payments'), (snap) => {
      let count = 0, total = 0
      snap.forEach((studentNode) => {
        studentNode.forEach((p) => {
          count++
          total += Number(p.val().amount || 0)
        })
      })
      setStats((s) => ({ ...s, payments: count, total }))
    })
    const u2 = onValue(ref(db, 'students'), (snap) => {
      let outstanding = 0
      snap.forEach((c) => { outstanding += Number(c.val().feeBalance || 0) })
      setStats((s) => ({ ...s, outstanding }))
    })
    return () => { u1(); u2() }
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0D3B66] mb-6">Finance Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#0D3B66] text-white rounded-xl p-5 shadow">
          <p className="text-sm opacity-80">Total Collected</p>
          <p className="text-3xl font-bold">${stats.total.toFixed(2)}</p>
        </div>
        <div className="bg-amber-500 text-white rounded-xl p-5 shadow">
          <p className="text-sm opacity-80">Outstanding</p>
          <p className="text-3xl font-bold">${stats.outstanding.toFixed(2)}</p>
        </div>
        <div className="bg-emerald-600 text-white rounded-xl p-5 shadow">
          <p className="text-sm opacity-80">Payments Recorded</p>
          <p className="text-3xl font-bold">{stats.payments}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { to: '/finance/record-payment', label: 'Record Payment' },
          { to: '/finance/transactions', label: 'Transactions' },
          { to: '/finance/reports', label: 'Financial Reports' },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="bg-white rounded-lg shadow p-4 text-[#0D3B66] font-semibold text-sm hover:bg-[#0D3B66] hover:text-white transition-colors text-center border border-slate-100">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
