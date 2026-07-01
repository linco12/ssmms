import { useState } from 'react'
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri' }
const DAY_FULL   = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday' }
const DAY_INDEX  = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' }
const MAX_PERIODS = 8

function todayKey() {
  const d = new Date().getDay() // 0=Sun,1=Mon...
  return DAY_INDEX[d] || null
}

function nowMinutes() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function PeriodCard({ slot, isCurrent, isNext }) {
  if (!slot) return null
  return (
    <div className={`rounded-xl p-3 border-l-4 ${
      isCurrent  ? 'bg-emerald-50 border-emerald-500' :
      isNext     ? 'bg-blue-50 border-[#0D3B66]' :
                   'bg-white border-slate-200 shadow-sm'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-bold text-sm ${isCurrent ? 'text-emerald-700' : isNext ? 'text-[#0D3B66]' : 'text-slate-800'}`}>
            {slot.subjectName}
          </p>
          {slot.teacherName && <p className="text-xs text-slate-500 mt-0.5">{slot.teacherName}</p>}
          {slot.label && <p className="text-xs text-slate-400 italic">{slot.label}</p>}
        </div>
        <div className="text-right shrink-0">
          {(slot.startTime || slot.endTime) && (
            <p className="text-xs font-mono text-slate-400">{slot.startTime}{slot.endTime ? `–${slot.endTime}` : ''}</p>
          )}
          {isCurrent && <span className="text-xs font-bold text-emerald-600">Now</span>}
          {isNext   && <span className="text-xs font-bold text-[#0D3B66]">Next</span>}
        </div>
      </div>
    </div>
  )
}

export default function TimetableView({ timetable = {}, className = '' }) {
  const [view, setView] = useState('today')
  const today = todayKey()
  const now = nowMinutes()

  const todaySlots = today
    ? Array.from({ length: MAX_PERIODS }, (_, i) => ({ period: i + 1, ...timetable[today]?.[i + 1] || {} }))
        .filter(s => s.subjectName)
    : []

  // Find current and next lesson
  let currentPeriod = null
  let nextPeriod = null
  if (today) {
    for (let p = 1; p <= MAX_PERIODS; p++) {
      const slot = timetable[today]?.[p]
      if (!slot?.startTime || !slot?.endTime) continue
      const start = timeToMin(slot.startTime)
      const end = timeToMin(slot.endTime)
      if (now >= start && now < end) { currentPeriod = p; break }
    }
    // Find next after current (or first upcoming)
    const startFrom = currentPeriod ? currentPeriod + 1 : 1
    for (let p = startFrom; p <= MAX_PERIODS; p++) {
      const slot = timetable[today]?.[p]
      if (slot?.subjectName && (!slot.startTime || timeToMin(slot.startTime) > now)) {
        nextPeriod = p; break
      }
    }
  }

  const isWeekend = !today

  return (
    <div>
      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit mb-4">
        <button onClick={() => setView('today')}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === 'today' ? 'bg-white text-[#0D3B66] shadow-sm' : 'text-slate-500'}`}>
          Today
        </button>
        <button onClick={() => setView('week')}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === 'week' ? 'bg-white text-[#0D3B66] shadow-sm' : 'text-slate-500'}`}>
          Full Week
        </button>
      </div>

      {/* Header */}
      {className && (
        <p className="text-xs text-slate-400 mb-3">Class: <span className="font-semibold text-slate-600">{className}</span></p>
      )}

      {/* Today view */}
      {view === 'today' && (
        <div>
          {isWeekend ? (
            <div className="bg-white rounded-xl shadow p-8 text-center text-slate-400">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-semibold">It's the weekend!</p>
              <p className="text-sm mt-1">Enjoy your time off. Next lessons start Monday.</p>
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-slate-700 mb-3 text-sm">{DAY_FULL[today]} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</h3>
              {todaySlots.length === 0 ? (
                <div className="bg-white rounded-xl shadow p-8 text-center text-slate-400">No lessons scheduled today.</div>
              ) : (
                <div className="space-y-2">
                  {todaySlots.map(s => (
                    <PeriodCard
                      key={s.period}
                      slot={timetable[today]?.[s.period]}
                      isCurrent={s.period === currentPeriod}
                      isNext={s.period === nextPeriod}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Weekly view */}
      {view === 'week' && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0D3B66] text-white">
                <th className="px-3 py-2.5 text-xs font-medium text-left w-12">P</th>
                {DAYS.map(d => (
                  <th key={d} className={`px-3 py-2.5 text-xs font-medium text-left ${d === today ? 'bg-blue-800' : ''}`}>
                    {DAY_LABELS[d]}
                    {d === today && <span className="ml-1 text-blue-300 text-xs">◆</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: MAX_PERIODS }, (_, i) => {
                const period = i + 1
                const hasAny = DAYS.some(d => timetable[d]?.[period]?.subjectName)
                if (!hasAny) return null
                return (
                  <tr key={period} className={period % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-3 py-2 text-xs font-bold text-slate-400 border-r border-slate-100">P{period}</td>
                    {DAYS.map(day => {
                      const slot = timetable[day]?.[period]
                      const isCur = day === today && period === currentPeriod
                      const isNxt = day === today && period === nextPeriod
                      return (
                        <td key={day} className={`px-2 py-1.5 border-r border-slate-100 ${isCur ? 'bg-emerald-50' : isNxt ? 'bg-blue-50' : ''}`}>
                          {slot?.subjectName ? (
                            <div>
                              <p className={`text-xs font-semibold ${isCur ? 'text-emerald-700' : isNxt ? 'text-[#0D3B66]' : 'text-slate-700'}`}>
                                {slot.subjectName}
                                {isCur && <span className="ml-1 text-emerald-500 font-bold">●</span>}
                              </p>
                              {slot.startTime && <p className="text-xs text-slate-400 font-mono">{slot.startTime}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

