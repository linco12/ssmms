import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import TimetableView from '../../components/TimetableView'

export default function StudentTimetablePage() {
  const { currentUser } = useAuth()
  const [timetable, setTimetable] = useState({})
  const [classGrade, setClassGrade] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    // Find student record linked to this user
    return onValue(ref(db, 'students'), snap => {
      let found = null
      snap.forEach(c => {
        const s = c.val()
        if (s.linkedStudentUid === currentUser.uid || c.key === currentUser.uid) {
          found = { key: c.key, ...s }
        }
      })
      if (!found) {
        // Try matching by UID directly
        setLoading(false)
        return
      }
      setClassGrade(found.classGrade || '')
      if (found.classKey) {
        onValue(ref(db, `timetable/${found.classKey}`), tSnap => {
          setTimetable(tSnap.exists() ? tSnap.val() : {})
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })
  }, [currentUser])

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">Loading timetable…</div>

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">My Timetable</h2>
      <p className="text-sm text-slate-400 mb-4">Your daily and weekly lesson schedule.</p>
      {Object.keys(timetable).length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center text-slate-400">
          No timetable has been set for your class yet.
        </div>
      ) : (
        <TimetableView timetable={timetable} className={classGrade} />
      )}
    </div>
  )
}
