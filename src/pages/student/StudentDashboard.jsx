import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'

export default function StudentDashboard() {
  const { userProfile } = useAuth()
  const [student, setStudent] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [allSubjects, setAllSubjects] = useState([])

  useEffect(() => {
    const studentKey = userProfile?.studentKey
    if (!studentKey) return
    const u1 = onValue(ref(db, `students/${studentKey}`), (snap) => {
      if (snap.exists()) setStudent({ key: snap.key, ...snap.val() })
    })
    const u2 = onValue(ref(db, `studentSubjects/${studentKey}`), (snap) => {
      setSubjects(snap.exists() ? Object.keys(snap.val()) : [])
    })
    const u3 = onValue(ref(db, 'subjects'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setAllSubjects(list)
    })
    return () => { u1(); u2(); u3() }
  }, [userProfile?.studentKey])

  const mySubjects = allSubjects.filter((s) => subjects.includes(s.key))

  if (!userProfile?.studentKey) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-6 text-sm">
        Your student record has not been linked yet. Please contact the administrator.
      </div>
    )
  }

  if (!student) return <p className="text-slate-400 text-sm">Loading your profile…</p>

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-[#0D3B66]">My Profile</h2>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-[#0D3B66] text-white flex items-center justify-center text-2xl font-bold">
            {student.fullName?.[0] || '?'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0D3B66]">{student.fullName}</h3>
            <p className="text-sm text-slate-500 font-mono">{student.studentId}</p>
          </div>
          <span className={`ml-auto text-xs px-3 py-1 rounded-full font-semibold ${
            student.enrollmentStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' :
            student.enrollmentStatus === 'Suspended' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>{student.enrollmentStatus}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Info label="Class" value={student.classGrade || '—'} />
          <Info label="Date of Birth" value={student.dateOfBirth || '—'} />
          <Info label="Guardian" value={student.guardianName || '—'} />
          <Info label="Guardian Contact" value={student.guardianContact || '—'} />
          <Info label="Academic Background" value={student.academicBackground || '—'} />
          {student.healthAlerts && <Info label="Health Alerts" value={student.healthAlerts} accent />}
        </div>
      </div>

      {/* Fee summary */}
      <div className={`rounded-xl shadow p-5 ${Number(student.feeBalance) > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Outstanding Balance</p>
        <p className={`text-3xl font-bold ${Number(student.feeBalance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          ${Number(student.feeBalance || 0).toFixed(2)}
        </p>
        {Number(student.feeBalance) === 0 && <p className="text-sm text-emerald-600 mt-1">All fees paid — well done!</p>}
      </div>

      {/* Subjects */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-semibold text-slate-700 mb-3">My Subjects ({mySubjects.length})</h3>
        {mySubjects.length === 0 ? (
          <p className="text-slate-400 text-sm">No subjects assigned yet. Contact your administrator.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {mySubjects.map((s) => (
              <span key={s.key} className="bg-blue-50 text-[#0D3B66] text-xs font-medium px-3 py-1.5 rounded-full border border-blue-100">
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value, accent }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`font-medium ${accent ? 'text-amber-600' : 'text-slate-700'}`}>{value}</p>
    </div>
  )
}
