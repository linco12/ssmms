import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, update, push, remove, set } from 'firebase/database'

export default function SchoolFeesPage() {
  const [tab, setTab] = useState('structure')

  // Fee structure data
  const [compulsory, setCompulsory] = useState([])        // [{ key, name, amount }]
  const [subjectFees, setSubjectFees] = useState({})       // { subjectKey: amount }
  const [subjects, setSubjects] = useState([])             // [{ key, name }]

  // Student fees data
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [filterClass, setFilterClass] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [bulkFee, setBulkFee] = useState('')
  const [editKey, setEditKey] = useState(null)
  const [editFee, setEditFee] = useState('')
  const [saving, setSaving] = useState(false)

  // New compulsory fee form
  const [newFeeName, setNewFeeName] = useState('')
  const [newFeeAmt, setNewFeeAmt] = useState('')
  const [editComp, setEditComp] = useState(null)  // { key, name, amount }

  useEffect(() => {
    const u1 = onValue(ref(db, 'students'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      setStudents(list)
    })
    const u2 = onValue(ref(db, 'classes'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setClasses(list)
    })
    const u3 = onValue(ref(db, 'subjects'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setSubjects(list)
    })
    const u4 = onValue(ref(db, 'feeStructure/compulsory'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      setCompulsory(list)
    })
    const u5 = onValue(ref(db, 'feeStructure/subjectFees'), snap => {
      setSubjectFees(snap.exists() ? snap.val() : {})
    })
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

  const compulsoryTotal = compulsory.reduce((s, f) => s + Number(f.amount || 0), 0)

  // ─── Compulsory fee CRUD ────────────────────────────────────────

  const addCompulsory = async () => {
    if (!newFeeName.trim() || !newFeeAmt) return
    await push(ref(db, 'feeStructure/compulsory'), { name: newFeeName.trim(), amount: Number(newFeeAmt) })
    setNewFeeName(''); setNewFeeAmt('')
  }

  const saveCompulsory = async () => {
    if (!editComp) return
    await update(ref(db, `feeStructure/compulsory/${editComp.key}`), { name: editComp.name, amount: Number(editComp.amount) })
    setEditComp(null)
  }

  const deleteCompulsory = async (key) => {
    if (!confirm('Remove this fee component?')) return
    await remove(ref(db, `feeStructure/compulsory/${key}`))
  }

  // ─── Subject fee editor ─────────────────────────────────────────

  const setSubjectFee = async (subjectKey, value) => {
    const amount = Number(value)
    if (amount > 0) {
      await set(ref(db, `feeStructure/subjectFees/${subjectKey}`), amount)
    } else {
      await remove(ref(db, `feeStructure/subjectFees/${subjectKey}`))
    }
  }

  // ─── Apply fee structure to all students ───────────────────────

  const applyFeeStructureToAll = async () => {
    if (!confirm(`Recalculate and apply term fees to ALL students based on the current fee structure?\n\nThis will update each student's termFee. Fee balances are not changed.`)) return
    setSaving(true)
    // For simplicity we set termFee = compulsoryTotal for all students
    // (subject-specific fees need per-student subject lookup, done on enrollment)
    const updates = {}
    students.forEach(s => {
      updates[`students/${s.key}/termFee`] = compulsoryTotal
    })
    await update(ref(db), updates)
    setSaving(false)
    alert(`Term fee set to $${compulsoryTotal.toFixed(2)} for ${students.length} students. Subject-specific fees are added automatically on student enrollment.`)
  }

  // ─── Student fees section (existing) ───────────────────────────

  const feeStatus = (s) => {
    const bal = Number(s.feeBalance || 0)
    if (bal < 0) return { label: 'Overpaid', color: 'bg-blue-100 text-blue-700' }
    if (bal === 0) return { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' }
    if (bal < (s.termFee || 0)) return { label: 'Partial', color: 'bg-amber-100 text-amber-700' }
    return { label: 'Unpaid', color: 'bg-red-100 text-red-700' }
  }

  const filtered = students.filter(s => {
    const matchClass = filterClass === 'All' || s.classGrade === filterClass
    const st = feeStatus(s).label
    const matchStatus = filterStatus === 'All' || st === filterStatus
    const matchSearch = s.fullName?.toLowerCase().includes(search.toLowerCase()) || s.studentId?.toLowerCase().includes(search.toLowerCase())
    return matchClass && matchStatus && matchSearch
  })

  const totalOwing = filtered.reduce((s, x) => s + Math.max(0, Number(x.feeBalance || 0)), 0)
  const totalBilled = filtered.reduce((s, x) => s + (Number(x.termFee || 0)), 0)
  const totalCollected = totalBilled - totalOwing
  const paidCount = filtered.filter(s => feeStatus(s).label === 'Paid').length

  const setTermFee = async (key, fee) => {
    setSaving(true)
    await update(ref(db, `students/${key}`), { termFee: Number(fee) })
    setEditKey(null)
    setSaving(false)
  }

  const applyBulkFee = async () => {
    if (!bulkFee || !confirm(`Set $${bulkFee} term fee for all ${filtered.length} shown students?`)) return
    setSaving(true)
    for (const s of filtered) {
      await update(ref(db, `students/${s.key}`), { termFee: Number(bulkFee) })
    }
    setBulkFee('')
    setSaving(false)
  }

  const TABS = [
    { id: 'structure', label: 'Fee Structure' },
    { id: 'students', label: 'Student Fees' },
  ]

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">School Fees</h2>
      <p className="text-sm text-slate-400 mb-4">Define fee components and manage student fee accounts.</p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-[#0D3B66] text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Fee Structure ═══════════════════════════════════ */}
      {tab === 'structure' && (
        <div className="space-y-6">

          {/* Compulsory fees */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-[#0D3B66]">Compulsory Fees</h3>
                <p className="text-xs text-slate-400">These fees apply to ALL students regardless of subjects.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total per student</p>
                <p className="text-xl font-bold text-[#0D3B66]">${compulsoryTotal.toFixed(2)}</p>
              </div>
            </div>

            {/* Existing compulsory fees */}
            <div className="space-y-2 mb-4">
              {compulsory.length === 0 && (
                <p className="text-sm text-slate-400 py-2">No fee components defined yet.</p>
              )}
              {compulsory.map(f => (
                <div key={f.key} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                  {editComp?.key === f.key ? (
                    <>
                      <input
                        value={editComp.name}
                        onChange={e => setEditComp(c => ({ ...c, name: e.target.value }))}
                        className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
                      />
                      <span className="text-slate-400">$</span>
                      <input
                        type="number"
                        value={editComp.amount}
                        onChange={e => setEditComp(c => ({ ...c, amount: e.target.value }))}
                        className="w-24 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
                      />
                      <button onClick={saveCompulsory} className="text-xs text-emerald-600 font-semibold px-2">Save</button>
                      <button onClick={() => setEditComp(null)} className="text-xs text-slate-400 px-1">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-slate-700">{f.name}</span>
                      <span className="text-sm font-bold text-[#0D3B66]">${Number(f.amount || 0).toFixed(2)}</span>
                      <button onClick={() => setEditComp({ ...f })} className="text-xs text-blue-500 hover:underline ml-2">Edit</button>
                      <button onClick={() => deleteCompulsory(f.key)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new compulsory fee */}
            <div className="flex gap-2 items-end flex-wrap pt-3 border-t border-slate-100">
              <div className="flex-1 min-w-32">
                <label className="block text-xs font-medium text-slate-500 mb-1">Fee Name</label>
                <input
                  value={newFeeName}
                  onChange={e => setNewFeeName(e.target.value)}
                  placeholder="e.g. Tuition Fees, Building Levy"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  value={newFeeAmt}
                  onChange={e => setNewFeeAmt(e.target.value)}
                  placeholder="0.00"
                  className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
                />
              </div>
              <button
                onClick={addCompulsory}
                disabled={!newFeeName.trim() || !newFeeAmt}
                className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-50"
              >
                + Add Fee
              </button>
            </div>
          </div>

          {/* Subject-specific fees */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-bold text-[#0D3B66] mb-1">Subject-Specific Fees</h3>
            <p className="text-xs text-slate-400 mb-4">
              Optional extra fee per subject. Only charged to students enrolled in that subject.
              Leave blank or $0 for no extra charge.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {subjects.map(sub => {
                const current = subjectFees[sub.key] || 0
                return (
                  <div key={sub.key} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm text-slate-700">{sub.name}</span>
                    <span className="text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      defaultValue={current || ''}
                      placeholder="0"
                      onBlur={e => setSubjectFee(sub.key, e.target.value)}
                      className="w-20 border border-slate-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
                    />
                  </div>
                )
              })}
              {subjects.length === 0 && (
                <p className="text-sm text-slate-400 col-span-2">No subjects defined. Add subjects first in the Subjects page.</p>
              )}
            </div>
          </div>

          {/* Fee summary & apply */}
          <div className="bg-[#0D3B66] text-white rounded-xl p-5">
            <h3 className="font-bold mb-2">Fee Structure Summary</h3>
            <p className="text-sm opacity-80 mb-3">
              Base fee for all students: <span className="font-bold">${compulsoryTotal.toFixed(2)}</span>
            </p>
            {Object.entries(subjectFees).length > 0 && (
              <div className="text-sm opacity-80 mb-3">
                <p>Additional subject fees:</p>
                <ul className="ml-4 mt-1 space-y-0.5">
                  {Object.entries(subjectFees).map(([sk, amt]) => {
                    const sub = subjects.find(s => s.key === sk)
                    return sub ? <li key={sk}>+ ${Number(amt).toFixed(2)} for {sub.name}</li> : null
                  })}
                </ul>
              </div>
            )}
            <p className="text-xs opacity-60 mb-4">
              When a student is enrolled in a class, their term fee is automatically set to the compulsory total
              plus any fees for the subjects in their class.
            </p>
            <button
              onClick={applyFeeStructureToAll}
              disabled={saving || compulsoryTotal === 0}
              className="bg-white text-[#0D3B66] px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-100 disabled:opacity-50"
            >
              {saving ? 'Applying…' : `Apply $${compulsoryTotal.toFixed(2)} to All ${students.length} Students`}
            </button>
          </div>
        </div>
      )}

      {/* ═══ TAB: Student Fees ════════════════════════════════════ */}
      {tab === 'students' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Billed', value: `$${totalBilled.toFixed(2)}`, bg: 'bg-[#0D3B66]' },
              { label: 'Collected', value: `$${totalCollected.toFixed(2)}`, bg: 'bg-emerald-600' },
              { label: 'Outstanding', value: `$${totalOwing.toFixed(2)}`, bg: 'bg-red-500' },
              { label: 'Fully Paid', value: `${paidCount} / ${filtered.length}`, bg: 'bg-blue-600' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} text-white rounded-xl p-4 shadow`}>
                <p className="text-xs opacity-80 mb-1">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Bulk fee setter */}
          <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Set Term Fee ($) for all shown students</label>
              <input type="number" min="0" value={bulkFee} onChange={e => setBulkFee(e.target.value)}
                placeholder="e.g. 600" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
            </div>
            <button onClick={applyBulkFee} disabled={saving || !bulkFee}
              className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60">
              Apply to {filtered.length} Students
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID…"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-36 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="All">All Classes</option>
              {classes.map(c => <option key={c.key}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
              {['All', 'Paid', 'Partial', 'Unpaid', 'Overpaid'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0D3B66] text-white">
                <tr>
                  {['Student', 'Class', 'Term Fee', 'Balance', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">No students match filters.</td></tr>
                )}
                {filtered.map(s => {
                  const st = feeStatus(s)
                  const bal = Number(s.feeBalance || 0)
                  return (
                    <tr key={s.key} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-sm">{s.fullName}</p>
                        <p className="text-xs text-slate-400 font-mono">{s.studentId}</p>
                      </td>
                      <td className="px-3 py-2 text-xs">{s.classGrade}</td>
                      <td className="px-3 py-2">
                        {editKey === s.key ? (
                          <div className="flex items-center gap-1">
                            <input type="number" value={editFee} onChange={e => setEditFee(e.target.value)}
                              autoFocus onKeyDown={e => { if (e.key === 'Enter') setTermFee(s.key, editFee); if (e.key === 'Escape') setEditKey(null) }}
                              className="w-20 border border-[#0D3B66] rounded px-1.5 py-1 text-sm focus:outline-none" />
                            <button onClick={() => setTermFee(s.key, editFee)} className="text-xs text-emerald-600 font-semibold">✓</button>
                            <button onClick={() => setEditKey(null)} className="text-xs text-slate-400">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditKey(s.key); setEditFee(String(s.termFee || 0)) }}
                            className="text-sm font-semibold text-slate-700 hover:text-[#0D3B66] underline">
                            ${Number(s.termFee || 0).toFixed(2)}
                          </button>
                        )}
                      </td>
                      <td className={`px-3 py-2 font-semibold text-sm ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                        {bal < 0 ? `$${Math.abs(bal).toFixed(2)} CR` : `$${bal.toFixed(2)}`}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <a href="/finance/record-payment" className="text-xs text-[#0D3B66] hover:underline">Record Payment</a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
