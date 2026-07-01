import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { computePeriodTimes, subjectColour } from '../../utils/timetableGenerator'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const DAY_LABELS = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday' }

export default function TeacherTimetablePage() {
  const { currentUser } = useAuth()
  const [timetable, setTimetable] = useState({})
  const [classes, setClasses]     = useState([])
  const [config, setConfig]       = useState(null)

  useEffect(() => {
    const uns = [
      onValue(ref(db, 'ssmms/timetable'), snap => setTimetable(snap.val() || {})),
      onValue(ref(db, 'ssmms/classes'),   snap => {
        const l = []; snap.forEach(c => l.push({ key: c.key, ...c.val() })); setClasses(l)
      }),
      onValue(ref(db, 'ssmms/timetableConfig/schedule'), snap => {
        if (snap.exists()) setConfig(snap.val())
      }),
    ]
    return () => uns.forEach(u => u())
  }, [])

  if (!config) return <p className="text-slate-400 text-sm py-8 text-center">Loading timetable…</p>

  const periodTimes = computePeriodTimes(config)
  const today = DAYS[new Date().getDay() - 1] || ''

  // Scan all class timetables for this teacher's slots
  const myGrid = {}
  for (const [classKey, days] of Object.entries(timetable)) {
    const cls = classes.find(c => c.key === classKey)
    for (const [day, periods] of Object.entries(days)) {
      for (const [period, slot] of Object.entries(periods)) {
        if (slot?.teacherUid === currentUser.uid) {
          if (!myGrid[day]) myGrid[day] = {}
          myGrid[day][period] = { ...slot, classKey, className: cls?.name || classKey }
        }
      }
    }
  }

  const totalPeriods = Object.values(myGrid).reduce((s, d) => s + Object.keys(d).length, 0)
  const maxPeriods   = Math.max(...DAYS.map(day => {
    const dt = config.weekSchedule?.[day] || 'fullDay'
    return Number(config.dayTypes?.[dt]?.periods || 8)
  }))

  const todaySlots = Object.entries(myGrid[today] || {})
    .sort(([a], [b]) => Number(a) - Number(b))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">My Timetable</h1>
        <p className="text-sm text-slate-500 mt-0.5">{totalPeriods} periods per week</p>
      </div>

      {/* Today */}
      {today && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold text-slate-700 mb-3">Today — {DAY_LABELS[today]}</h2>
          {todaySlots.length === 0 ? (
            <p className="text-sm text-slate-400">No classes scheduled today.</p>
          ) : (
            <div className="space-y-2">
              {todaySlots.map(([period, slot]) => {
                const dt     = config.weekSchedule?.[today] || 'fullDay'
                const times  = periodTimes[dt]?.[Number(period) - 1]
                const now    = new Date()
                const nowM   = now.getHours() * 60 + now.getMinutes()
                const startM = times ? Number(times.start.split(':')[0]) * 60 + Number(times.start.split(':')[1]) : -1
                const endM   = times ? Number(times.end.split(':')[0])   * 60 + Number(times.end.split(':')[1])   : -1
                const isNow  = nowM >= startM && nowM < endM
                return (
                  <div key={period} className={`flex items-center gap-3 p-3 rounded-lg border ${isNow ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}>
                    {isNow && <span className="text-xs bg-green-500 text-white rounded px-1.5 py-0.5 font-semibold shrink-0">NOW</span>}
                    <div className="text-xs text-slate-400 w-24 shrink-0">
                      {times ? `${times.start} – ${times.end}` : `Period ${period}`}
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${subjectColour(slot.subjectKey).split(' ')[0]}`} />
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{slot.subjectName}</p>
                      <p className="text-xs text-slate-500">{slot.className}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Full week grid */}
      <div>
        <h2 className="font-semibold text-slate-700 mb-3">Full Week</h2>
        {totalPeriods === 0 ? (
          <p className="text-sm text-slate-400">No lessons assigned yet. The admin needs to generate the timetable.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#0D3B66] text-white">
                  <th className="p-2 text-left font-medium w-28">Period</th>
                  {DAYS.map(day => (
                    <th key={day} className={`p-2 text-center font-medium ${day === today ? 'bg-blue-800' : ''}`}>
                      {DAY_LABELS[day].slice(0, 3)}
                      {day === today && <div className="text-xs font-normal opacity-70">Today</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxPeriods }, (_, i) => i + 1).map(period => (
                  <tr key={period} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-2 text-xs text-slate-400 font-medium">
                      <div>Period {period}</div>
                      {(() => {
                        const dt = config.weekSchedule?.monday || 'fullDay'
                        const t  = periodTimes[dt]?.[period - 1]
                        return t ? <div className="text-slate-300">{t.start}</div> : null
                      })()}
                    </td>
                    {DAYS.map(day => {
                      const dayType  = config.weekSchedule?.[day] || 'fullDay'
                      const nPeriods = Number(config.dayTypes?.[dayType]?.periods || 8)
                      const slot     = myGrid[day]?.[period]
                      if (period > nPeriods) return <td key={day} className="p-1 bg-slate-50" />
                      return (
                        <td key={day} className={`p-1 ${day === today ? 'bg-blue-50/20' : ''}`}>
                          {slot ? (
                            <div className={`rounded border p-1.5 text-xs ${subjectColour(slot.subjectKey)}`}>
                              <div className="font-semibold leading-tight">{slot.subjectName}</div>
                              <div className="opacity-70 text-xs leading-tight">{slot.className}</div>
                            </div>
                          ) : (
                            <div className="h-10 rounded border border-dashed border-slate-100 flex items-center justify-center">
                              <span className="text-slate-200 text-xs">—</span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {(config.breaks || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-4">
                {config.breaks.map(b => (
                  <span key={b.id} className="text-xs text-slate-400">
                    ☕ {b.label} ({b.duration} min) after Period {b.afterPeriod}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
