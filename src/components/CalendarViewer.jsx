import { useState } from 'react'

export const EVENT_TYPES = {
  holiday: { label: 'Holiday',   color: 'bg-red-500',     border: 'border-red-500'    },
  exam:    { label: 'Exam',      color: 'bg-amber-500',   border: 'border-amber-500'  },
  sports:  { label: 'Sports',    color: 'bg-emerald-500', border: 'border-emerald-500'},
  meeting: { label: 'Meeting',   color: 'bg-blue-500',    border: 'border-blue-500'   },
  term:    { label: 'Term',      color: 'bg-[#0D3B66]',   border: 'border-[#0D3B66]' },
  event:   { label: 'Event',     color: 'bg-violet-500',  border: 'border-violet-500' },
}

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function eventsOnDate(events, ds) {
  return events.filter(e => {
    if (e.date === ds) return true
    if (e.endDate && e.date <= ds && e.endDate >= ds) return true
    return false
  })
}

export function EventCard({ event: e, onDelete, showDate }) {
  const type = EVENT_TYPES[e.type] || EVENT_TYPES.event
  return (
    <div className={`bg-white rounded-xl shadow p-4 border-l-4 ${type.border}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {showDate && (
            <p className="text-xs text-slate-400 mb-1">
              {new Date(e.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {e.endDate && e.endDate !== e.date && (
                ` – ${new Date(e.endDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
              )}
            </p>
          )}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full text-white font-semibold ${type.color}`}>
              {type.label}
            </span>
          </div>
          <p className="font-semibold text-slate-800">{e.title}</p>
          {e.description && <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{e.description}</p>}
        </div>
        {onDelete && (
          <button onClick={() => onDelete(e.key)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
        )}
      </div>
    </div>
  )
}

export default function CalendarViewer({ events = [], onAddEvent, onDeleteEvent }) {
  const [view, setView] = useState('calendar')
  const [navDate, setNavDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const year = navDate.getFullYear()
  const month = navDate.getMonth()
  const monthLabel = navDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().slice(0, 10)

  const selectedEvents = selectedDate ? eventsOnDate(events, selectedDate) : []

  const upcoming = [...events]
    .filter(e => (e.endDate || e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === 'calendar' ? 'bg-white text-[#0D3B66] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Month
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === 'list' ? 'bg-white text-[#0D3B66] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Events List
          </button>
        </div>
        {onAddEvent && (
          <button
            onClick={onAddEvent}
            className="ml-auto bg-[#0D3B66] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#0a2f52]"
          >
            + Add Event
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(EVENT_TYPES).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-full ${v.color}`} />
            {v.label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {view === 'calendar' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-[#0D3B66] text-white">
            <button onClick={() => setNavDate(new Date(year, month - 1, 1))} className="hover:bg-white/20 rounded px-2 py-1 text-sm">◀</button>
            <h3 className="font-bold">{monthLabel}</h3>
            <button onClick={() => setNavDate(new Date(year, month + 1, 1))} className="hover:bg-white/20 rounded px-2 py-1 text-sm">▶</button>
          </div>
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-bold text-slate-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDow }, (_, i) => (
              <div key={`p${i}`} className="min-h-[4.5rem] bg-slate-50 border-r border-b border-slate-100" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const ds = isoDate(year, month, day)
              const dayEvts = eventsOnDate(events, ds)
              const isToday = ds === today
              const isSel = ds === selectedDate

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(isSel ? null : ds)}
                  className={`min-h-[4.5rem] border-r border-b border-slate-100 p-1.5 cursor-pointer transition-colors
                    ${isSel ? 'bg-blue-50 ring-2 ring-inset ring-[#0D3B66]' : 'hover:bg-slate-50'}`}
                >
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1
                    ${isToday ? 'bg-[#0D3B66] text-white' : 'text-slate-700'}`}>
                    {day}
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {dayEvts.slice(0, 3).map(e => (
                      <span key={e.key} className={`w-2 h-2 rounded-full block ${EVENT_TYPES[e.type]?.color || 'bg-violet-500'}`} />
                    ))}
                    {dayEvts.length > 3 && <span className="text-xs text-slate-400 leading-none">+{dayEvts.length - 3}</span>}
                  </div>
                  {dayEvts.slice(0, 1).map(e => (
                    <p key={e.key} className="text-xs text-slate-500 truncate leading-tight mt-0.5">{e.title}</p>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected date panel */}
      {view === 'calendar' && selectedDate && (
        <div className="mt-4 bg-white rounded-xl shadow p-4">
          <h4 className="font-semibold text-[#0D3B66] mb-3 text-sm">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h4>
          {selectedEvents.length === 0 ? (
            <p className="text-slate-400 text-sm">No events on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(e => <EventCard key={e.key} event={e} onDelete={onDeleteEvent} />)}
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <div className="bg-white rounded-xl shadow p-10 text-center text-slate-400">No upcoming events.</div>
          )}
          {upcoming.map(e => (
            <EventCard key={e.key} event={e} onDelete={onDeleteEvent} showDate />
          ))}
        </div>
      )}
    </div>
  )
}
