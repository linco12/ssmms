import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, set } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'
import { createNotification } from '../../services/notificationService'
import FeatureGate from '../../components/FeatureGate'

function gradeFromPct(pct) {
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B'
  if (pct >= 60) return 'C'
  if (pct >= 50) return 'D'
  return 'F'
}

export default function ResultsPage() {
  const { currentUser, userProfile } = useAuth()
  const [allSubjects, setAllSubjects] = useState([])
  const [assessments, setAssessments] = useState([])
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentSubjectKeys, setStudentSubjectKeys] = useState([])
  // marks: { [subjectKey]: { [assessmentKey]: rawMarks (string for input) } }
  const [marks, setMarks] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const assignedClassKey = userProfile?.assignedClassKey || null
  const assignedClass = userProfile?.assignedClass || null

  useEffect(() => {
    const u1 = onValue(ref(db, 'subjects'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setAllSubjects(list)
    })
    const u2 = onValue(ref(db, 'assessments'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      setAssessments(list)
    })
    const u3 = onValue(ref(db, 'students'), (snap) => {
      const list = []
      snap.forEach((c) => {
        const s = c.val()
        if (!assignedClassKey || s.classKey === assignedClassKey) list.push({ key: c.key, ...s })
      })
      setStudents(list)
    })
    return () => { u1(); u2(); u3() }
  }, [assignedClassKey])

  // Load student's subject keys
  useEffect(() => {
    if (!selectedStudent) { setStudentSubjectKeys([]); return }
    return onValue(ref(db, `studentSubjects/${selectedStudent.key}`), (snap) => {
      setStudentSubjectKeys(snap.exists() ? Object.keys(snap.val()) : [])
    })
  }, [selectedStudent])

  // Load existing marks when student changes
  useEffect(() => {
    if (!selectedStudent) { setMarks({}); return }
    return onValue(ref(db, `academicResults/${selectedStudent.key}`), (snap) => {
      if (snap.exists()) {
        // Convert stored numbers to strings for controlled inputs
        const loaded = {}
        snap.forEach((subSnap) => {
          loaded[subSnap.key] = {}
          subSnap.forEach((aSnap) => {
            loaded[subSnap.key][aSnap.key] = String(aSnap.val())
          })
        })
        setMarks(loaded)
      } else {
        setMarks({})
      }
    })
  }, [selectedStudent])

  const mySubjects = allSubjects.filter((s) => studentSubjectKeys.includes(s.key))

  const setMark = (subjectKey, assessmentKey, value) => {
    setMarks((prev) => ({
      ...prev,
      [subjectKey]: { ...(prev[subjectKey] || {}), [assessmentKey]: value },
    }))
  }

  const maxTotal = assessments.reduce((s, a) => s + (Number(a.outOf) || 0), 0)

  const subjectTotal = (subjectKey) => {
    const subMarks = marks[subjectKey] || {}
    return assessments.reduce((s, a) => {
      const v = Number(subMarks[a.key])
      return s + (isNaN(v) ? 0 : v)
    }, 0)
  }

  const handleSave = async () => {
    if (!selectedStudent) return
    setSaving(true)
    try {
      // Build clean object: only save numeric values
      const toSave = {}
      for (const [subKey, subMarks] of Object.entries(marks)) {
        toSave[subKey] = {}
        for (const [aKey, val] of Object.entries(subMarks)) {
          const n = Number(val)
          if (!isNaN(n) && val !== '') toSave[subKey][aKey] = n
        }
        if (Object.keys(toSave[subKey]).length === 0) delete toSave[subKey]
      }
      await set(ref(db, `academicResults/${selectedStudent.key}`), Object.keys(toSave).length ? toSave : null)
      await logAction(currentUser, 'UPDATE', 'academicResults', {
        studentId: selectedStudent.studentId,
        name: selectedStudent.fullName,
      })
      if (selectedStudent.linkedParentUid) {
        await createNotification(selectedStudent.linkedParentUid, {
          title: 'Results Updated',
          body: `Marks for ${selectedStudent.fullName} have been updated.`,
          type: 'results',
          link: '/parent/results',
        })
      }
      if (selectedStudent.linkedStudentUid) {
        await createNotification(selectedStudent.linkedStudentUid, {
          title: 'Your Results Are In',
          body: 'Your marks have been updated by your teacher.',
          type: 'results',
          link: '/student/results',
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FeatureGate flag="academicRecords">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-1">Results & Marks</h2>
        {assignedClass && <p className="text-sm text-slate-400 mb-4">Your class: <strong>{assignedClass}</strong></p>}

        {!assignedClass && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 mb-4 text-sm">
            No class assigned. Ask the Administrator to assign you a class under <strong>Admin → Classes</strong>.
          </div>
        )}

        {assessments.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 mb-4 text-sm">
            No assessment types configured. Ask the Administrator to set them up under <strong>Admin → Assessments</strong>.
          </div>
        )}

        {/* Student picker */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Student</label>
          <select
            value={selectedStudent?.key || ''}
            onChange={(e) => {
              const s = students.find((st) => st.key === e.target.value)
              setSelectedStudent(s || null)
              setSaved(false)
            }}
            className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
          >
            <option value="">— Select student —</option>
            {students.map((s) => (
              <option key={s.key} value={s.key}>{s.fullName} — {s.classGrade || s.classKey}</option>
            ))}
          </select>
        </div>

        {selectedStudent && (
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <span className="font-semibold text-slate-700">{selectedStudent.fullName}</span>
                <span className="text-slate-400 text-sm ml-2">({selectedStudent.studentId})</span>
              </div>
              {saved && (
                <span className="text-sm text-emerald-600 font-medium">Saved & student notified ✓</span>
              )}
            </div>

            {mySubjects.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
                No subjects assigned. Go to <strong>Admin → Students → Subjects</strong>.
              </div>
            ) : assessments.length === 0 ? null : (
              <>
                {/* Marks grid — horizontal scroll on mobile */}
                <div className="bg-white rounded-xl shadow overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#0D3B66] text-white">
                        <th className="px-3 py-2.5 text-left text-xs font-medium sticky left-0 bg-[#0D3B66] min-w-[160px]">
                          Subject
                        </th>
                        {assessments.map((a) => (
                          <th key={a.key} className="px-3 py-2.5 text-center text-xs font-medium whitespace-nowrap min-w-[90px]">
                            {a.name}
                            <span className="block text-blue-200 font-normal">/{a.outOf}</span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-center text-xs font-medium min-w-[80px]">Total</th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium min-w-[60px]">%</th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium min-w-[44px]">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubjects.map((sub) => {
                        const total = subjectTotal(sub.key)
                        const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0
                        const grade = gradeFromPct(pct)
                        const gradeColor = { A: 'text-emerald-600', B: 'text-blue-600', C: 'text-amber-600', D: 'text-orange-500', F: 'text-red-600' }

                        return (
                          <tr key={sub.key} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white">{sub.name}</td>
                            {assessments.map((a) => {
                              const aOof = Number(a.outOf) || 100
                              const val = marks[sub.key]?.[a.key] ?? ''
                              const num = Number(val)
                              const invalid = val !== '' && (isNaN(num) || num < 0 || num > aOof)
                              return (
                                <td key={a.key} className="px-2 py-1.5 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max={aOof}
                                    value={val}
                                    onChange={(e) => setMark(sub.key, a.key, e.target.value)}
                                    placeholder="—"
                                    className={`w-16 text-center border rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0D3B66] ${
                                      invalid ? 'border-red-400 bg-red-50' : 'border-slate-300'
                                    }`}
                                  />
                                </td>
                              )
                            })}
                            <td className="px-3 py-2 text-center font-semibold text-slate-700">
                              {total > 0 ? `${total}/${maxTotal}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {total > 0 ? `${pct}%` : '—'}
                            </td>
                            <td className={`px-3 py-2 text-center font-bold ${total > 0 ? gradeColor[grade] : 'text-slate-300'}`}>
                              {total > 0 ? grade : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-4 bg-[#0D3B66] text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save All Marks'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </FeatureGate>
  )
}
