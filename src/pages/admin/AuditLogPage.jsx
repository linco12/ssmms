import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database'
import FeatureGate from '../../components/FeatureGate'

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = query(ref(db, 'auditLogs'), orderByChild('timestamp'), limitToLast(200))
    return onValue(q, (snap) => {
      const list = []
      snap.forEach((child) => { list.push({ key: child.key, ...child.val() }) })
      setLogs(list.reverse())
    })
  }, [])

  const filtered = logs.filter(
    (l) =>
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.entity?.toLowerCase().includes(search.toLowerCase()) ||
      l.displayName?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <FeatureGate flag="auditTrail">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-4">Audit Log</h2>
        <input
          type="text"
          placeholder="Filter by action, entity, or user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
        />
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0D3B66] text-white">
              <tr>
                {['Time', 'User', 'Action', 'Entity', 'Details'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">No audit entries</td></tr>
              )}
              {filtered.map((l) => (
                <tr key={l.key} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                    {l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">{l.displayName}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      l.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                      l.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{l.action}</span>
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">{l.entity}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-xs truncate">
                    {JSON.stringify(l.details)}
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
