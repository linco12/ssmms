import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import FeatureGate from '../../components/FeatureGate'

function gradeFromPct(pct) {
  if (pct >= 80) return { label: 'A', color: 'text-emerald-600 bg-emerald-50' }
  if (pct >= 70) return { label: 'B', color: 'text-blue-600 bg-blue-50' }
  if (pct >= 60) return { label: 'C', color: 'text-amber-600 bg-amber-50' }
  if (pct >= 50) return { label: 'D', color: 'text-orange-500 bg-orange-50' }
  return { label: 'F', color: 'text-red-600 bg-red-50' }
}

export default function ParentResultsPage() {
  const { currentUser } = useAuth()
  const [student, setStudent] = useState(null)
  const [results, setResults] = useState({})
  const [subjectKeys, setSubjectKeys] = useState([])
  const [allSubjects, setAllSubjects] = useState([])
  const [assessments, setAssessments] = useState([])

  useEffect(() => {
    if (!currentUser) return
    const q = query(ref(db, 'ssmms/students'), orderByChild('linkedParentUid'), equalTo(currentUser.uid))
    const u1 = onValue(q, (snap) => {
      if (!snap.exists()) return
      const entries = Object.entries(snap.val())
      const s = { key: entries[0][0], ...entries[0][1] }
      setStudent(s)
    })
    const u2 = onValue(ref(db, 'ssmms/subjects'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setAllSubjects(list)
    })
    const u3 = onValue(ref(db, 'ssmms/assessments'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      setAssessments(list)
    })
    return () => { u1(); u2(); u3() }
  }, [currentUser])

  useEffect(() => {
    if (!student) return
    const u1 = onValue(ref(db, `ssmms/academicResults/${student.key}`), (snap) => {
      setResults(snap.exists() ? snap.val() : {})
    })
    const u2 = onValue(ref(db, `ssmms/studentSubjects/${student.key}`), (snap) => {
      setSubjectKeys(snap.exists() ? Object.keys(snap.val()) : [])
    })
    return () => { u1(); u2() }
  }, [student])

  const mySubjects = allSubjects.filter((s) => subjectKeys.includes(s.key))
  const maxTotal = assessments.reduce((s, a) => s + (Number(a.outOf) || 0), 0)

  const subjectTotal = (subKey) =>
    assessments.reduce((s, a) => {
      const v = Number(results[subKey]?.[a.key])
      return s + (isNaN(v) ? 0 : v)
    }, 0)

  if (!student) return (
    <FeatureGate flag="academicRecords">
      <p className="text-slate-400 text-sm">No student linked to this account.</p>
    </FeatureGate>
  )

  return (
    <FeatureGate flag="academicRecords">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-1">Academic Results</h2>
        <p className="text-sm text-slate-400 mb-5">{student.fullName} — {student.classGrade}</p>

        {mySubjects.length === 0 || assessments.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">No results available yet.</div>
        ) : (
          <div className="space-y-4">
            {mySubjects.map((sub) => {
              const subResults = results[sub.key] || {}
              const total = subjectTotal(sub.key)
              const pct = maxTotal > 0 && total > 0 ? Math.round((total / maxTotal) * 100) : null
              const grade = pct !== null ? gradeFromPct(pct) : null

              return (
                <div key={sub.key} className="bg-white rounded-xl shadow overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <span className="font-semibold text-[#0D3B66]">{sub.name}</span>
                    {pct !== null && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{total}/{maxTotal} ({pct}%)</span>
                        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${grade.color}`}>{grade.label}</span>
                      </div>
                    )}
                  </div>
                  <div className="divide-y divide-slate-50">
                    {assessments.map((a) => {
                      const mark = subResults[a.key]
                      const hasValue = mark !== undefined && mark !== null
                      return (
                        <div key={a.key} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-slate-600">{a.name}</span>
                          {hasValue
                            ? <span className="font-semibold text-slate-800">{mark}<span className="text-slate-400 font-normal">/{a.outOf}</span></span>
                            : <span className="text-slate-300 text-sm">Not marked</span>
                          }
                        </div>
                      )
                    })}
                  </div>
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
        )}
      </div>
    </FeatureGate>
  )
}
