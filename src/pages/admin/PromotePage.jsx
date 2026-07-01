import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, update, remove } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'
import { nextForm } from '../../config/schoolConfig'

export default function PromotePage() {
  const { currentUser } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [feeStructure, setFeeStructure] = useState({})
  const [terms, setTerms] = useState([])
  const [sourceKey, setSourceKey] = useState('')
  const [targetKey, setTargetKey] = useState('')
  const [carryFees, setCarryFees] = useState(true)
  const [applyNewFees, setApplyNewFees] = useState(true)
  const [promoting, setPromoting] = useState(false)
  const [result, setResult] = useState(null)
  const [tab, setTab] = useState('promote')

  useEffect(() => {
    const u1 = onValue(ref(db, 'classes'), snap => {
      const list = []; snap.forEach(c => { list.push({ key: c.key, ...c.val() }) }); list.sort((a, b) => a.name.localeCompare(b.name)); setClasses(list)
    })
    const u2 = onValue(ref(db, 'students'), snap => {
      const list = []; snap.forEach(c => { list.push({ key: c.key, ...c.val() }) }); setStudents(list)
    })
    const u3 = onValue(ref(db, 'feeStructure'), snap => { setFeeStructure(snap.exists() ? snap.val() : {}) })
    const u4 = onValue(ref(db, 'terms'), snap => {
      const list = []; snap.forEach(c => { list.push({ key: c.key, ...c.val() }) }); setTerms(list)
    })
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  const sourceClass = classes.find(c => c.key === sourceKey)
  const targetClass = classes.find(c => c.key === targetKey)
  const currentTerm = terms.find(t => t.isCurrent)

  const handleSourceChange = (key) => {
    setSourceKey(key); setTargetKey(''); setResult(null)
    const cls = classes.find(c => c.key === key)
    if (!cls) return
    const next = nextForm(cls.form)
    if (!next) return
    const suggested = classes.find(c => c.form === next && c.section === cls.section)
    if (suggested) setTargetKey(suggested.key)
  }

  const studentsInSource = students.filter(s => s.classKey === sourceKey && s.enrollmentStatus === 'Active')
  const form6Students = students.filter(s => {
    const cls = classes.find(c => c.key === s.classKey)
    return cls && Number(cls.form) === 6 && s.enrollmentStatus === 'Active'
  })

  const compulsoryTotal = Object.values(feeStructure.compulsory || {}).reduce((s, f) => s + Number(f.amount || 0), 0)

  const calcNewFees = (classKey) => {
    const classSubs = Object.keys({}) // classSubjects not loaded here, use base
    return compulsoryTotal
  }

  const buildPromoteData = (s, toClass) => {
    const updates = {
      classKey: toClass.key,
      classGrade: toClass.name,
      previousClass: s.classGrade,
      promotedAt: new Date().toISOString(),
    }
    if (applyNewFees && compulsoryTotal > 0) {
      // New term fee = compulsory total
      updates.termFee = compulsoryTotal
      if (carryFees) {
        // Carry over any credit or add to existing balance
        const prevBalance = Number(s.feeBalance || 0)
        if (prevBalance < 0) {
          // Credit — reduce new term fee
          updates.feeBalance = compulsoryTotal + prevBalance
        } else {
          // Still owes — add to new term fee
          updates.feeBalance = compulsoryTotal + prevBalance
        }
      } else {
        // Fresh start
        updates.feeBalance = compulsoryTotal
      }
    } else if (carryFees) {
      // Keep same balance, just reset term fee
      updates.termFee = compulsoryTotal || s.termFee || 0
    }
    return updates
  }

  const promoteAll = async () => {
    if (!sourceKey || !targetKey || studentsInSource.length === 0) return
    setPromoting(true); setResult(null)
    let count = 0
    for (const s of studentsInSource) {
      const data = buildPromoteData(s, targetClass)
      await update(ref(db, `students/${s.key}`), data)
      await logAction(currentUser, 'PROMOTION', 'student', { studentId: s.studentId, name: s.fullName, from: sourceClass.name, to: targetClass.name })
      count++
    }
    setResult({ count, from: sourceClass.name, to: targetClass.name })
    setPromoting(false)
  }

  const promoteSingle = async (student) => {
    if (!targetKey) return
    const data = buildPromoteData(student, targetClass)
    await update(ref(db, `students/${student.key}`), data)
    await logAction(currentUser, 'PROMOTION', 'student', { studentId: student.studentId, name: student.fullName, from: sourceClass.name, to: targetClass.name })
    setResult({ count: 1, from: sourceClass.name, to: targetClass.name, name: student.fullName })
  }

  const graduateForm6 = async () => {
    if (!confirm(`Graduate all ${form6Students.length} active Form 6 students? They will be marked as Graduated and removed from active rolls.`)) return
    setPromoting(true)
    for (const s of form6Students) {
      await update(ref(db, `students/${s.key}`), {
        enrollmentStatus: 'Graduated',
        graduatedAt: new Date().toISOString(),
        graduatedYear: new Date().getFullYear(),
      })
      await logAction(currentUser, 'GRADUATION', 'student', { studentId: s.studentId, name: s.fullName })
    }
    setResult({ graduated: form6Students.length })
    setPromoting(false)
  }

  const newTermFeeAll = async () => {
    if (!compulsoryTotal) { alert('No compulsory fee structure defined. Set fees first under School Fees → Fee Structure.'); return }
    if (!confirm(`Apply new term fees to ALL active students?\n\nBase fee: $${compulsoryTotal.toFixed(2)}\nBalance carry-over: ${carryFees ? 'YES' : 'NO (fresh start)'}`)) return
    setPromoting(true)
    const active = students.filter(s => s.enrollmentStatus === 'Active')
    for (const s of active) {
      const prevBalance = carryFees ? Number(s.feeBalance || 0) : 0
      await update(ref(db, `students/${s.key}`), {
        termFee: compulsoryTotal,
        feeBalance: compulsoryTotal + (prevBalance > 0 ? prevBalance : 0),
        prevTermCredit: prevBalance < 0 ? Math.abs(prevBalance) : 0,
      })
    }
    setResult({ fees: active.length, amount: compulsoryTotal })
    setPromoting(false)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">End of Term / Year</h2>
      <p className="text-sm text-slate-500 mb-5">Promote students, graduate Form 6, and apply new term fees.</p>

      {currentTerm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-blue-700">
          Current term: <span className="font-semibold">{currentTerm.name}</span> · ends {new Date(currentTerm.endDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {result.graduated !== undefined && `${result.graduated} Form 6 student${result.graduated !== 1 ? 's' : ''} graduated.`}
          {result.fees !== undefined && `New term fees ($${result.fees > 0 ? result.fees : compulsoryTotal}) applied to ${result.fees} students.`}
          {result.count !== undefined && (
            result.name
              ? `${result.name} promoted from ${result.from} to ${result.to}.`
              : `${result.count} student${result.count !== 1 ? 's' : ''} promoted from ${result.from} to ${result.to}.`
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[{ id: 'promote', label: 'Promote Students' }, { id: 'term', label: 'New Term Fees' }, { id: 'graduate', label: 'Graduate Form 6' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${tab === t.id ? 'bg-[#0D3B66] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Promote ══════════════════════════════════════════════ */}
      {tab === 'promote' && (
        <div>
          <div className="bg-white rounded-xl shadow p-5 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From Class</label>
                <select value={sourceKey} onChange={e => handleSourceChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
                  <option value="">— Select current class —</option>
                  {classes.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To Class</label>
                <select value={targetKey} onChange={e => setTargetKey(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
                  <option value="">— Select target class —</option>
                  {classes.filter(c => c.key !== sourceKey).map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={carryFees} onChange={e => setCarryFees(e.target.checked)} className="accent-[#0D3B66]" />
                <span className="text-slate-700">Carry over unpaid balance to new term</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={applyNewFees} onChange={e => setApplyNewFees(e.target.checked)} className="accent-[#0D3B66]" />
                <span className="text-slate-700">Apply new term fee {compulsoryTotal > 0 ? `($${compulsoryTotal.toFixed(2)})` : ''}</span>
              </label>
            </div>

            {sourceKey && targetKey && (
              <button onClick={promoteAll} disabled={promoting || studentsInSource.length === 0}
                className="bg-[#0D3B66] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60">
                {promoting ? 'Promoting…' : `Promote All ${studentsInSource.length} Active Students → ${targetClass?.name}`}
              </button>
            )}
          </div>

          {sourceKey && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-2">Active students in {sourceClass?.name} ({studentsInSource.length})</h3>
              {studentsInSource.length === 0 && <p className="text-slate-400 text-sm">No active students.</p>}
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#0D3B66] text-white">
                    <tr>
                      {['ID', 'Name', 'Fee Balance', 'Promote'].map(h => <th key={h} className="px-3 py-2.5 text-left text-xs font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {studentsInSource.map(s => (
                      <tr key={s.key} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs">{s.studentId}</td>
                        <td className="px-3 py-2 font-medium">{s.fullName}</td>
                        <td className={`px-3 py-2 text-xs font-semibold ${Number(s.feeBalance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          ${Number(s.feeBalance || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          {targetKey ? (
                            <button onClick={() => promoteSingle(s)} className="text-xs bg-[#0D3B66] text-white px-3 py-1 rounded hover:bg-[#0a2f52]">
                              → {targetClass?.name}
                            </button>
                          ) : <span className="text-xs text-slate-300">Select target first</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ New Term Fees ════════════════════════════════════════ */}
      {tab === 'term' && (
        <div className="max-w-xl">
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <h3 className="font-semibold text-slate-700">Apply New Term Fees to All Students</h3>
            <p className="text-sm text-slate-500">
              Use this at the start of each new term. Sets the term fee based on the current fee structure
              and optionally carries over any outstanding or credit balance from the previous term.
            </p>
            {compulsoryTotal > 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-blue-700">Base term fee: ${compulsoryTotal.toFixed(2)}</p>
                <p className="text-xs text-blue-500 mt-0.5">Defined in School Fees → Fee Structure</p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                No fee structure defined. Go to School Fees → Fee Structure to set compulsory fees first.
              </div>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={carryFees} onChange={e => setCarryFees(e.target.checked)} className="accent-[#0D3B66]" />
                <span className="text-sm text-slate-700">
                  Carry unpaid balance from previous term (student pays old balance + new term fee)
                </span>
              </label>
              <p className="text-xs text-slate-400 ml-5">
                {carryFees
                  ? 'Students with credit will have their new balance reduced by the credit amount.'
                  : 'All balances reset to the new term fee only (previous outstanding balance is cleared — use with caution).'}
              </p>
            </div>
            <button onClick={newTermFeeAll} disabled={promoting || compulsoryTotal === 0}
              className="w-full bg-[#0D3B66] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60">
              {promoting ? 'Applying…' : `Apply $${compulsoryTotal.toFixed(2)} to All Active Students`}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Graduate Form 6 ═════════════════════════════════════ */}
      {tab === 'graduate' && (
        <div className="max-w-xl">
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <h3 className="font-semibold text-slate-700">Graduate Form 6 Students</h3>
            <p className="text-sm text-slate-500">
              Run this at the end of the academic year. Form 6 students will be marked as <strong>Graduated</strong>
              and removed from active class rolls. Their academic records are preserved.
            </p>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-semibold text-slate-700">{form6Students.length} active Form 6 student{form6Students.length !== 1 ? 's' : ''}</p>
              {form6Students.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-slate-500">
                  {form6Students.slice(0, 8).map(s => <li key={s.key}>• {s.fullName} ({s.studentId})</li>)}
                  {form6Students.length > 8 && <li className="text-slate-400">…and {form6Students.length - 8} more</li>}
                </ul>
              )}
            </div>
            <button onClick={graduateForm6} disabled={promoting || form6Students.length === 0}
              className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
              {promoting ? 'Processing…' : `Graduate ${form6Students.length} Form 6 Students`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
