import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'

export default function ParentDashboard() {
  const { currentUser } = useAuth()
  const [student, setStudent] = useState(null)

  useEffect(() => {
    if (!currentUser) return
    const q = query(ref(db, 'ssmms/students'), orderByChild('linkedParentUid'), equalTo(currentUser.uid))
    return onValue(q, (snap) => {
      if (snap.exists()) {
        const entries = Object.entries(snap.val())
        setStudent({ key: entries[0][0], ...entries[0][1] })
      }
    })
  }, [currentUser])

  if (!student) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">No student linked to your account.</p>
        <p className="text-sm mt-2">Please contact the school administrator.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0D3B66] mb-6">My Child's Profile</h1>
      <div className="bg-white rounded-xl shadow p-6 max-w-xl">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['Full Name', student.fullName],
            ['Student ID', student.studentId],
            ['Class / Grade', student.classGrade],
            ['Date of Birth', student.dateOfBirth],
            ['Guardian', student.guardianName],
            ['Guardian Contact', student.guardianContact],
            ['Enrollment Status', student.enrollmentStatus || 'Active'],
            ['Health Alerts', student.healthAlerts || 'None'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-slate-400 text-xs font-medium">{label}</p>
              <p className="font-semibold text-slate-700">{value || '—'}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-slate-400 font-medium">Academic Background</p>
          <p className="text-sm text-slate-700 mt-1">{student.academicBackground || 'Not specified'}</p>
        </div>
      </div>
    </div>
  )
}
