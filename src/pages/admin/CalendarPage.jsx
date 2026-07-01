import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, set, remove, update } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import CalendarViewer, { EVENT_TYPES } from '../../components/CalendarViewer'

const BLANK_EVENT = { title: '', date: '', endDate: '', description: '', type: 'event', termKey: '' }
const BLANK_TERM = { name: '', academicYear: new Date().getFullYear(), termNumber: 1, startDate: '', endDate: '', isCurrent: false }

export default function CalendarPage() {
  const { currentUser } = useAuth()
  const [tab, setTab] = useState('calendar')
  const [events, setEvents] = useState([])
  const [terms, setTerms] = useState([])

  // Event form
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventForm, setEventForm] = useState(BLANK_EVENT)
  const [savingEvent, setSavingEvent] = useState(false)

  // Term form
  const [showTermModal, setShowTermModal] = useState(false)
  const [termForm, setTermForm] = useState(BLANK_TERM)
  const [editTermKey, setEditTermKey] = useState(null)
  const [savingTerm, setSavingTerm] = useState(false)

  useEffect(() => {
    const u1 = onValue(ref(db, 'calendarEvents'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.date.localeCompare(b.date))
      setEvents(list)
    })
    const u2 = onValue(ref(db, 'terms'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.startDate?.localeCompare(b.startDate || '') || 0)
      setTerms(list)
    })
    return () => { u1(); u2() }
  }, [])

  // ─── Events ────────────────────────────────────────────────────

  const openAddEvent = (date) => {
    setEventForm({ ...BLANK_EVENT, date: date || '' })
    setShowEventModal(true)
  }

  const saveEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date) return
    setSavingEvent(true)
    const data = {
      title: eventForm.title.trim(),
      date: eventForm.date,
      endDate: eventForm.endDate || eventForm.date,
      description: eventForm.description.trim(),
      type: eventForm.type,
      termKey: eventForm.termKey || null,
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString(),
    }
    await push(ref(db, 'calendarEvents'), data)
    setShowEventModal(false)
    setEventForm(BLANK_EVENT)
    setSavingEvent(false)
  }

  const deleteEvent = async (key) => {
    if (!confirm('Delete this event?')) return
    await remove(ref(db, `calendarEvents/${key}`))
  }

  // ─── Terms ─────────────────────────────────────────────────────

  const openAddTerm = () => { setTermForm(BLANK_TERM); setEditTermKey(null); setShowTermModal(true) }
  const openEditTerm = (t) => { setTermForm(t); setEditTermKey(t.key); setShowTermModal(true) }

  const saveTerm = async () => {
    if (!termForm.name.trim() || !termForm.startDate || !termForm.endDate) return
    setSavingTerm(true)
    const data = {
      name: termForm.name.trim(),
      academicYear: Number(termForm.academicYear),
      termNumber: Number(termForm.termNumber),
      startDate: termForm.startDate,
      endDate: termForm.endDate,
      isCurrent: !!termForm.isCurrent,
    }
    if (editTermKey) {
      await update(ref(db, `terms/${editTermKey}`), data)
    } else {
      await push(ref(db, 'terms'), data)
      // Also create term-start and term-end calendar events
      await push(ref(db, 'calendarEvents'), {
        title: `${data.name} Begins`,
        date: data.startDate,
        endDate: data.startDate,
        description: `Start of ${data.name}`,
        type: 'term',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
      })
      await push(ref(db, 'calendarEvents'), {
        title: `${data.name} Ends`,
        date: data.endDate,
        endDate: data.endDate,
        description: `End of ${data.name}`,
        type: 'term',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
      })
    }
    // If marking as current, unset others
    if (data.isCurrent) {
      const others = terms.filter(t => t.key !== editTermKey && t.isCurrent)
      for (const t of others) {
        await update(ref(db, `terms/${t.key}`), { isCurrent: false })
      }
    }
    setShowTermModal(false)
    setSavingTerm(false)
  }

  const deleteTerm = async (key) => {
    if (!confirm('Delete this term?')) return
    await remove(ref(db, `terms/${key}`))
  }

  const currentTerm = terms.find(t => t.isCurrent)

  const EF = ({ label, name, type = 'text', options, rows }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {options ? (
        <select value={eventForm[name]} onChange={e => setEventForm(f => ({ ...f, [name]: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
          {options.map(o => <option key={o.v || o} value={o.v || o}>{o.l || o}</option>)}
        </select>
      ) : rows ? (
        <textarea value={eventForm[name]} onChange={e => setEventForm(f => ({ ...f, [name]: e.target.value }))}
          rows={rows} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none" />
      ) : (
        <input type={type} value={eventForm[name]} onChange={e => setEventForm(f => ({ ...f, [name]: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
      )}
    </div>
  )

  const TF = ({ label, name, type = 'text', options }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {options ? (
        <select value={termForm[name]} onChange={e => setTermForm(f => ({ ...f, [name]: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
          {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
        </select>
      ) : (
        <input type={type} value={termForm[name] ?? ''} onChange={e => setTermForm(f => ({ ...f, [name]: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
      )}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-[#0D3B66]">School Calendar</h2>
        {currentTerm && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold">
            Current: {currentTerm.name} · ends {new Date(currentTerm.endDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-4">Manage school terms and calendar events.</p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[{ id: 'calendar', label: 'Calendar & Events' }, { id: 'terms', label: 'Terms' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${tab === t.id ? 'bg-[#0D3B66] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Calendar tab ════════════════════════════════════════ */}
      {tab === 'calendar' && (
        <CalendarViewer
          events={events}
          onAddEvent={() => openAddEvent('')}
          onDeleteEvent={deleteEvent}
        />
      )}

      {/* ═══ Terms tab ═══════════════════════════════════════════ */}
      {tab === 'terms' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={openAddTerm}
              className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52]">
              + New Term
            </button>
          </div>

          {terms.length === 0 && <p className="text-slate-400 text-sm">No terms defined yet.</p>}

          <div className="space-y-3">
            {terms.map(t => (
              <div key={t.key} className={`bg-white rounded-xl shadow p-4 flex items-center gap-4 ${t.isCurrent ? 'ring-2 ring-emerald-400' : ''}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-slate-800">{t.name}</p>
                    {t.isCurrent && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Current</span>}
                  </div>
                  <p className="text-xs text-slate-400">
                    {t.startDate ? new Date(t.startDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '?'} —
                    {t.endDate ? new Date(t.endDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '?'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEditTerm(t)} className="text-xs text-[#0D3B66] hover:underline">Edit</button>
                  <button onClick={() => deleteTerm(t.key)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Add Event modal ───────────────────────────────────── */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-bold text-[#0D3B66]">Add Calendar Event</h3>
            <EF label="Event Title *" name="title" />
            <div className="grid grid-cols-2 gap-3">
              <EF label="Start Date *" name="date" type="date" />
              <EF label="End Date" name="endDate" type="date" />
            </div>
            <EF label="Type" name="type" options={Object.entries(EVENT_TYPES).map(([v, t]) => ({ v, l: t.label }))} />
            <EF label="Term (optional)" name="termKey"
              options={[{ v: '', l: '— Any / General —' }, ...terms.map(t => ({ v: t.key, l: t.name }))]} />
            <EF label="Description / Details" name="description" rows={3} />
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowEventModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveEvent} disabled={savingEvent || !eventForm.title || !eventForm.date}
                className="px-4 py-2 text-sm bg-[#0D3B66] text-white rounded-lg disabled:opacity-60">
                {savingEvent ? 'Saving…' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add/Edit Term modal ───────────────────────────────── */}
      {showTermModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-bold text-[#0D3B66]">{editTermKey ? 'Edit Term' : 'New School Term'}</h3>
            <TF label="Term Name *" name="name" />
            <div className="grid grid-cols-2 gap-3">
              <TF label="Academic Year" name="academicYear" type="number" />
              <TF label="Term Number" name="termNumber" options={[1,2,3].map(n => ({ v: n, l: `Term ${n}` }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TF label="Start Date *" name="startDate" type="date" />
              <TF label="End Date *" name="endDate" type="date" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!termForm.isCurrent}
                onChange={e => setTermForm(f => ({ ...f, isCurrent: e.target.checked }))}
                className="accent-[#0D3B66]" />
              <span className="text-sm text-slate-700">This is the current active term</span>
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowTermModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveTerm} disabled={savingTerm || !termForm.name || !termForm.startDate || !termForm.endDate}
                className="px-4 py-2 text-sm bg-[#0D3B66] text-white rounded-lg disabled:opacity-60">
                {savingTerm ? 'Saving…' : editTermKey ? 'Save Changes' : 'Create Term'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
