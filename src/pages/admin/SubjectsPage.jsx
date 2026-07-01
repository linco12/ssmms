import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, remove, update, set } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'

const LEVELS = ['Junior', 'Junior/O Level', 'O Level', 'O Level/A Level', 'A Level']

const LEVEL_COLORS = {
  'Junior':         'bg-violet-50 text-violet-700',
  'Junior/O Level': 'bg-blue-50 text-blue-700',
  'O Level':        'bg-emerald-50 text-emerald-700',
  'O Level/A Level':'bg-teal-50 text-teal-700',
  'A Level':        'bg-amber-50 text-amber-700',
}

export default function SubjectsPage() {
  const { currentUser } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('All')
  const [newName, setNewName] = useState('')
  const [newLevel, setNewLevel] = useState('O Level')
  const [editKey, setEditKey] = useState(null)
  const [editName, setEditName] = useState('')
  const [editLevel, setEditLevel] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onValue(ref(db, 'ssmms/subjects'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setSubjects(list)
    })
  }, [])

  const filtered = subjects.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchLevel = levelFilter === 'All' || s.level === levelFilter
    return matchSearch && matchLevel
  })

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      alert('That subject already exists.')
      return
    }
    setSaving(true)
    const r = push(ref(db, 'ssmms/subjects'))
    await set(r, { name, level: newLevel, createdAt: new Date().toISOString() })
    await logAction(currentUser, 'CREATE', 'subject', { name, level: newLevel })
    setNewName('')
    setSaving(false)
  }

  const handleDelete = async (subject) => {
    if (!confirm(`Delete "${subject.name}"?`)) return
    await remove(ref(db, `ssmms/subjects/${subject.key}`))
    await logAction(currentUser, 'DELETE', 'subject', { name: subject.name })
  }

  const startEdit = (s) => { setEditKey(s.key); setEditName(s.name); setEditLevel(s.level || 'O Level') }

  const handleEdit = async (subject) => {
    const name = editName.trim()
    if (!name) { setEditKey(null); return }
    await update(ref(db, `ssmms/subjects/${subject.key}`), { name, level: editLevel })
    await logAction(currentUser, 'UPDATE', 'subject', { from: subject.name, to: name })
    setEditKey(null)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">Subjects</h2>
      <p className="text-sm text-slate-500 mb-5">
        Full ZIMSEC subject list. Add custom subjects or edit existing ones. Assign subjects to classes at <strong>Admin → Classes</strong>.
      </p>

      {/* Add new */}
      <div className="bg-white rounded-xl shadow p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-slate-600 mb-1">Subject Name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Additional Mathematics"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Level</label>
          <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <button onClick={handleAdd} disabled={saving || !newName.trim()}
          className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60">
          + Add Subject
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects…"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
          <option value="All">All Levels</option>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>

      {/* Subject list */}
      <div className="bg-white rounded-xl shadow divide-y">
        {filtered.length === 0 && (
          <p className="text-center py-8 text-slate-400 text-sm">No subjects match your search.</p>
        )}
        {filtered.map((s) => (
          <div key={s.key} className="flex items-center gap-3 px-4 py-2.5">
            {editKey === s.key ? (
              <>
                <input autoFocus type="text" value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(s); if (e.key === 'Escape') setEditKey(null) }}
                  className="flex-1 border border-[#0D3B66] rounded px-2 py-1 text-sm focus:outline-none"
                />
                <select value={editLevel} onChange={(e) => setEditLevel(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none">
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
                <button onClick={() => handleEdit(s)} className="text-xs text-emerald-600 font-semibold hover:underline">Save</button>
                <button onClick={() => setEditKey(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-slate-700">{s.name}</span>
                {s.level && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${LEVEL_COLORS[s.level] || 'bg-slate-100 text-slate-500'}`}>
                    {s.level}
                  </span>
                )}
                <button onClick={() => startEdit(s)} className="text-xs text-[#0D3B66] hover:underline shrink-0">Edit</button>
                <button onClick={() => handleDelete(s)} className="text-xs text-red-500 hover:underline shrink-0">Delete</button>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3">
        Showing {filtered.length} of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
