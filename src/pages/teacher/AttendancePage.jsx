import { useEffect, useMemo, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, set, get } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'
import FeatureGate from '../../components/FeatureGate'

const toDateKey = (dateStr) => dateStr.replace(/-/g, '')
const toDisplay = (dateKey) => {
  const y = dateKey.slice(0,4), m = dateKey.slice(4,6), d = dateKey.slice(6,8)
  return new Date(`${y}-${m}-${d}`).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
}

export default function AttendancePage() {
  const { currentUser, userProfile } = useAuth()

  const [students,     setStudents]     = useState([])
  const [classKey,     setClassKey]     = useState(null)
  const [allAttendance, setAllAttendance] = useState({}) // { [dateKey]: { noLesson, students:{} } }
  const [date,         setDate]         = useState(new Date().toISOString().split('T')[0])
  const [dayState,     setDayState]     = useState({ students: {}, noLesson: false }) // current day edits
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)

  const assignedClass = userProfile?.assignedClass || null

  // Load students + resolve classKey
  useEffect(() => {
    if (!assignedClass) return
    const unsub1 = onValue(ref(db, 'students'), snap => {
      const list = []
      snap.forEach(c => {
        const s = c.val()
        if (s.classGrade === assignedClass) list.push({ key: c.key, ...s })
      })
      setStudents(list.sort((a,b) => (a.fullName||'').localeCompare(b.fullName||'')))
    })
    // Resolve classKey from classes node
    get(ref(db, 'classes')).then(snap => {
      snap.forEach(c => {
        if (c.val().name === assignedClass) setClassKey(c.key)
      })
    })
    return unsub1
  }, [assignedClass])

  // Load all attendance for this class
  useEffect(() => {
    if (!classKey) return
    return onValue(ref(db, `attendance/${classKey}`), snap => {
      setAllAttendance(snap.val() || {})
    })
  }, [classKey])

  // When date changes, load that day's state into editable form
  useEffect(() => {
    const dk = toDateKey(date)
    const existing = allAttendance[dk]
    if (existing) {
      setDayState({ students: existing.students || {}, noLesson: existing.noLesson || false })
    } else {
      // Default: everyone present
      const defaultStudents = {}
      students.forEach(s => { defaultStudents[s.key] = 'present' })
      setDayState({ students: defaultStudents, noLesson: false })
    }
  }, [date, allAttendance, students])

  const toggle = (key) =>
    setDayState(prev => ({
      ...prev,
      students: { ...prev.students, [key]: prev.students[key] === 'present' ? 'absent' : 'present' }
    }))

  const markAllPresent = () =>
    setDayState(prev => {
      const updated = {}
      students.forEach(s => { updated[s.key] = 'present' })
      return { ...prev, students: updated, noLesson: false }
    })

  const markAllAbsent = () =>
    setDayState(prev => {
      const updated = {}
      students.forEach(s => { updated[s.key] = 'absent' })
      return { ...prev, students: updated, noLesson: false }
    })

  const markNoLesson = async () => {
    if (!classKey) return
    const dk = toDateKey(date)
    setSaving(true)
    try {
      await set(ref(db, `attendance/${classKey}/${dk}`), {
        noLesson: true,
        markedBy: currentUser.uid,
        markedAt: Date.now(),
        students: {},
      })
      await logAction(currentUser, 'UPDATE', 'attendance', { date, classKey, noLesson: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!classKey) return
    setSaving(true)
    const dk = toDateKey(date)
    try {
      await set(ref(db, `attendance/${classKey}/${dk}`), {
        noLesson: false,
        markedBy: currentUser.uid,
        markedAt: Date.now(),
        students: dayState.students,
      })
      await logAction(currentUser, 'UPDATE', 'attendance', { date, classKey })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  // Calculate attendance % per student across all lesson days
  const attendanceStats = useMemo(() => {
    const lessonDays = Object.entries(allAttendance).filter(([, v]) => !v.noLesson)
    const stats = {}
    students.forEach(s => {
      let present = 0, total = 0
      lessonDays.forEach(([, day]) => {
        const st = day.students?.[s.key]
        if (st) { total++; if (st === 'present') present++ }
      })
      stats[s.key] = { present, total, pct: total > 0 ? Math.round((present / total) * 100) : null }
    })
    return stats
  }, [allAttendance, students])

  const dk         = toDateKey(date)
  const isSaved    = Boolean(allAttendance[dk])
  const isNoLesson = allAttendance[dk]?.noLesson === true
  const presentCount = Object.values(dayState.students).filter(v => v === 'present').length
  const absentCount  = students.length - presentCount

  return (
    <FeatureGate flag="academicRecords">
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold text-[#0D3B66]">Attendance</h2>
            {assignedClass && <p className="text-sm text-slate-400">{assignedClass} · {students.length} students</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
            {isSaved && (
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${isNoLesson ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                {isNoLesson ? '— No lesson' : '✓ Marked'}
              </span>
            )}
            {saved && <span className="text-emerald-600 text-sm font-medium">Saved!</span>}
          </div>
        </div>

        {/* ── Action buttons ──────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={markAllPresent} disabled={dayState.noLesson}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 disabled:opacity-40">
            ✓ Mark All Present
          </button>
          <button onClick={markAllAbsent} disabled={dayState.noLesson}
            className="px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-40">
            ✗ Mark All Absent
          </button>
          <button onClick={markNoLesson} disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-40">
            — No Lesson Today
          </button>
          {!dayState.noLesson && (
            <span className="text-xs text-slate-400 self-center ml-1">
              {presentCount} present · {absentCount} absent
            </span>
          )}
        </div>

        {isNoLesson && allAttendance[dk] ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500 mb-4">
            <div className="text-2xl mb-2">—</div>
            <p className="font-semibold">No lesson on {toDisplay(dk)}</p>
            <p className="text-xs mt-1">This day does not count towards attendance.</p>
            <button onClick={() => setDayState(prev => ({ ...prev, noLesson: false }))}
              className="mt-3 text-xs text-[#0D3B66] font-medium underline">
              Mark attendance instead
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-[#0D3B66] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium">Student</th>
                    <th className="px-3 py-3 text-center text-xs font-medium">Today</th>
                    <th className="px-3 py-3 text-center text-xs font-medium">Attendance %</th>
                    <th className="px-3 py-3 text-center text-xs font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const status = dayState.students[s.key] || 'present'
                    const stat   = attendanceStats[s.key] || { present: 0, total: 0, pct: null }
                    const pctColor = stat.pct === null ? 'text-slate-400'
                      : stat.pct >= 80 ? 'text-emerald-600'
                      : stat.pct >= 60 ? 'text-amber-600'
                      : 'text-red-600'
                    return (
                      <tr key={s.key} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{s.fullName}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => toggle(s.key)}
                            className={`text-xs px-4 py-1.5 rounded-full font-semibold transition-colors min-w-20 ${
                              status === 'present'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}>
                            {status === 'present' ? '✓ Present' : '✗ Absent'}
                          </button>
                        </td>
                        <td className={`px-3 py-2 text-center font-bold text-sm ${pctColor}`}>
                          {stat.pct !== null ? `${stat.pct}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-slate-400">
                          {stat.total > 0 ? `${stat.present}/${stat.total}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {students.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                      {assignedClass ? 'No students found in your class.' : 'No class assigned to your account.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <button onClick={handleSave} disabled={saving || students.length === 0}
              className="bg-[#0D3B66] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60 transition-colors">
              {saving ? 'Saving…' : `Save Attendance for ${toDisplay(dk)}`}
            </button>
          </>
        )}

        {/* ── Attendance log ──────────────────────────────────────── */}
        {Object.keys(allAttendance).length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-bold text-slate-600 mb-3">Recent Attendance Log</h3>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {Object.entries(allAttendance)
                .sort(([a],[b]) => b.localeCompare(a))
                .slice(0,10)
                .map(([dk, day]) => {
                  const total   = Object.keys(day.students || {}).length
                  const present = Object.values(day.students || {}).filter(v => v === 'present').length
                  return (
                    <div key={dk}
                      onClick={() => setDate(`${dk.slice(0,4)}-${dk.slice(4,6)}-${dk.slice(6,8)}`)}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer last:border-0">
                      <span className="text-sm font-medium text-slate-700">{toDisplay(dk)}</span>
                      {day.noLesson
                        ? <span className="text-xs text-slate-400 font-medium">No lesson</span>
                        : <span className="text-xs font-semibold text-emerald-600">{present}/{total} present</span>
                      }
                    </div>
                  )
              })}
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  )
}
