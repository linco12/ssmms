import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, update, remove, set } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'

const BLANK = { name: '', outOf: 100, order: 99 }

export default function AssessmentsPage() {
  const { currentUser } = useAuth()
  const [assessments, setAssessments] = useState([])
  const [form, setForm] = useState(BLANK)
  const [editKey, setEditKey] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onValue(ref(db, 'ssmms/assessments'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name))
      setAssessments(list)
    })
  }, [])

  const openEdit = (a) => { setForm(a); setEditKey(a.key) }
  const cancelEdit = () => { setForm(BLANK); setEditKey(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const data = { name: form.name.trim(), outOf: Number(form.outOf) || 100, order: Number(form.order) || 99 }
    if (editKey) {
      await update(ref(db, `ssmms/assessments/${editKey}`), data)
      await logAction(currentUser, 'UPDATE', 'assessment', { name: data.name })
    } else {
      const r = push(ref(db, 'ssmms/assessments'))
      await set(r, { ...data, createdAt: new Date().toISOString() })
      await logAction(currentUser, 'CREATE', 'assessment', { name: data.name })
    }
    setForm(BLANK)
    setEditKey(null)
    setSaving(false)
  }

  const handleDelete = async (a) => {
    if (!confirm(`Delete assessment "${a.name}"? All saved marks for this assessment will be orphaned.`)) return
    await remove(ref(db, `ssmms/assessments/${a.key}`))
    await logAction(currentUser, 'DELETE', 'assessment', { name: a.name })
  }

  const total = assessments.reduce((s, a) => s + (Number(a.outOf) || 0), 0)

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">Assessments</h2>
      <p className="text-sm text-slate-500 mb-5">
        Define the assessment components and their maximum marks. Teachers enter marks against each component.
      </p>

      {/* Form */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{editKey ? 'Edit Assessment' : 'Add Assessment'}</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Test 1, Course Work, End of Term Exam"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max Marks</label>
            <input
              type="number" min="1" max="500"
              value={form.outOf}
              onChange={(e) => setForm((f) => ({ ...f, outOf: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Display Order</label>
            <input
              type="number" min="1"
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
            />
          </div>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60">
            {saving ? 'Saving…' : editKey ? 'Update' : '+ Add'}
          </button>
          {editKey && (
            <button onClick={cancelEdit} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {assessments.length === 0 ? (
        <p className="text-slate-400 text-sm">No assessments yet. Add some above.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0D3B66] text-white">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium">Order</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium">Assessment Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium">Max Marks</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.key} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{a.order}</td>
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="bg-blue-50 text-[#0D3B66] text-xs font-semibold px-2 py-0.5 rounded">/{a.outOf}</span>
                  </td>
                  <td className="px-4 py-2.5 flex gap-3">
                    <button onClick={() => openEdit(a)} className="text-[#0D3B66] hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(a)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-slate-600">Total possible marks</td>
                <td className="px-4 py-2.5">
                  <span className="bg-[#0D3B66] text-white text-xs font-bold px-2 py-0.5 rounded">/{total}</span>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
