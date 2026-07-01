import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'

function gradeFromPct(pct) {
  if (pct >= 80) return { label: 'A', color: 'text-emerald-600 bg-emerald-50' }
  if (pct >= 70) return { label: 'B', color: 'text-blue-600 bg-blue-50' }
  if (pct >= 60) return { label: 'C', color: 'text-amber-600 bg-amber-50' }
  if (pct >= 50) return { label: 'D', color: 'text-orange-500 bg-orange-50' }
  return { label: 'F', color: 'text-red-600 bg-red-50' }
}

export default function StudentResultsPage() {
  const { userProfile } = useAuth()
  const [results, setResults] = useState({})
  const [subjectKeys, setSubjectKeys] = useState([])
  const [allSubjects, setAllSubjects] = useState([])
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)

  const studentKey = userProfile?.studentKey

  useEffect(() => {
    if (!studentKey) { setLoading(false); return }
    const u1 = onValue(ref(db, `academicResults/${studentKey}`), (snap) => {
      setResults(snap.exists() ? snap.val() : {})
      setLoading(false)
    })
    const u2 = onValue(ref(db, `studentSubjects/${studentKey}`), (snap) => {
      setSubjectKeys(snap.exists() ? Object.keys(snap.val()) : [])
    })
    const u3 = onValue(ref(db, 'subjects'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setAllSubjects(list)
    })
    const u4 = onValue(ref(db, 'assessments'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      setAssessments(list)
    })
    return () => { u1(); u2(); u3(); u4() }
  }, [studentKey])

  const mySubjects = allSubjects.filter((s) => subjectKeys.includes(s.key))
  const maxTotal = assessments.reduce((s, a) => s + (Number(a.outOf) || 0), 0)

  const subjectTotal = (subjectKey) =>
    assessments.reduce((s, a) => {
      const v = Number(results[subjectKey]?.[a.key])
      return s + (isNaN(v) ? 0 : v)
    }, 0)

  if (!studentKey) return (
    <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-6 text-sm">
      Your student record has not been linked yet. Contact the administrator.
    </div>
  )

  if (loading) return <p className="text-slate-400 text-sm">Loading results…</p>

  const hasResults = mySubjects.some((s) => Object.keys(results[s.key] || {}).length > 0)

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-4">My Results</h2>

      {!hasResults && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 mb-4 text-sm">
          No marks have been entered yet. Check back after your teacher submits results.
        </div>
      )}

      <div className="space-y-4">
        {mySubjects.map((sub) => {
          const subResults = results[sub.key] || {}
          const total = subjectTotal(sub.key)
          const pct = maxTotal > 0 && total > 0 ? Math.round((total / maxTotal) * 100) : null
          const grade = pct !== null ? gradeFromPct(pct) : null

          return (
            <div key={sub.key} className="bg-white rounded-xl shadow overflow-hidden">
              {/* Subject header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="font-semibold text-[#0D3B66]">{sub.name}</span>
                <div className="flex items-center gap-3">
                  {pct !== null && (
                    <>
                      <span className="text-sm text-slate-500 font-medium">{total}/{maxTotal} ({pct}%)</span>
                      <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${grade.color}`}>{grade.label}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Assessment rows */}
              <div className="divide-y divide-slate-50">
                {assessments.map((a) => {
                  const mark = subResults[a.key]
                  const hasValue = mark !== undefined && mark !== null
                  return (
                    <div key={a.key} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-slate-600">{a.name}</span>
                      <div className="text-right">
                        {hasValue ? (
                          <span className="font-semibold text-slate-800">{mark}<span className="text-slate-400 font-normal">/{a.outOf}</span></span>
                        ) : (
                          <span className="text-slate-300 text-sm">Not marked</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total row */}
              {pct !== null && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                  <span className="text-sm font-semibold text-slate-600">Total</span>
                  <span className="font-bold text-[#0D3B66]">{total}/{maxTotal} — {pct}%</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
