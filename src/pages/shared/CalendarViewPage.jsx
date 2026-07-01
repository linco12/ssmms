import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue } from 'firebase/database'
import CalendarViewer from '../../components/CalendarViewer'

export default function CalendarViewPage() {
  const [events, setEvents] = useState([])
  const [terms, setTerms] = useState([])

  useEffect(() => {
    const u1 = onValue(ref(db, 'ssmms/calendarEvents'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.date.localeCompare(b.date))
      setEvents(list)
    })
    const u2 = onValue(ref(db, 'ssmms/terms'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      setTerms(list)
    })
    return () => { u1(); u2() }
  }, [])

  const currentTerm = terms.find(t => t.isCurrent)

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-[#0D3B66]">School Calendar</h2>
        {currentTerm && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold">
            {currentTerm.name} · {new Date(currentTerm.startDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(currentTerm.endDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-4">View upcoming events, term dates, and school activities.</p>
      <CalendarViewer events={events} />
    </div>
  )
}
