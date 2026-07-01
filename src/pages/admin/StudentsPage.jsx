import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, update, remove, set } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'

const FORM_COLORS = {
  '1': 'bg-indigo-500', '2': 'bg-sky-500', '3': 'bg-teal-500',
  '4': 'bg-orange-500', '5': 'bg-violet-500', '6': 'bg-rose-500',
}
const FORM_LIGHT = {
  '1': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '2': 'bg-sky-50 text-sky-700 border-sky-200',
  '3': 'bg-teal-50 text-teal-700 border-teal-200',
  '4': 'bg-orange-50 text-orange-700 border-orange-200',
  '5': 'bg-violet-50 text-violet-700 border-violet-200',
  '6': 'bg-rose-50 text-rose-700 border-rose-200',
}
function formNum(classGrade) { return (classGrade?.match(/\d+/) || [''])[0] }

function generateStudentId() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  return 'STU-' + Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('')
}

const BLANK = {
  fullName: '', dateOfBirth: '', classKey: '', guardianName: '', guardianContact: '',
  academicBackground: '', healthAlerts: '', enrollmentStatus: 'Active', feeBalance: 0, termFee: 500,
  linkedParentUid: '', linkedStudentUid: '',
}

export default function StudentsPage() {
  const { currentUser } = useAuth()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classSubjects, setClassSubjects] = useState({})
  const [studentSubjects, setStudentSubjects] = useState({})
  const [academicResults, setAcademicResults] = useState({})
  const [assessments, setAssessments] = useState([])
  const [feeStructure, setFeeStructure] = useState({ compulsory: {}, subjectFees: {} })
  const [search, setSearch] = useState('')
  const [formFilter, setFormFilter] = useState('All')
  const [classFilter, setClassFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [deleteKey, setDeleteKey] = useState(null)
  const [detailStudent, setDetailStudent] = useState(null)
  const [subjectStudent, setSubjectStudent] = useState(null)
  const [userAccounts, setUserAccounts] = useState([])

  useEffect(() => {
    const uns = [
      onValue(ref(db, 'students'), snap => { const l = []; snap.forEach(c => { l.push({ key: c.key, ...c.val() }) }); setStudents(l) }),
      onValue(ref(db, 'classes'), snap => { const l = []; snap.forEach(c => { l.push({ key: c.key, ...c.val() }) }); l.sort((a,b) => a.name.localeCompare(b.name)); setClasses(l) }),
      onValue(ref(db, 'subjects'), snap => { const l = []; snap.forEach(c => { l.push({ key: c.key, ...c.val() }) }); l.sort((a,b) => a.name.localeCompare(b.name)); setSubjects(l) }),
      onValue(ref(db, 'classSubjects'), snap => setClassSubjects(snap.exists() ? snap.val() : {})),
      onValue(ref(db, 'studentSubjects'), snap => setStudentSubjects(snap.exists() ? snap.val() : {})),
      onValue(ref(db, 'academicResults'), snap => setAcademicResults(snap.exists() ? snap.val() : {})),
      onValue(ref(db, 'assessments'), snap => { const l = []; snap.forEach(c => { l.push({ key: c.key, ...c.val() }) }); l.sort((a,b) => (a.order||0)-(b.order||0)); setAssessments(l) }),
      onValue(ref(db, 'feeStructure'), snap => { setFeeStructure(snap.exists() ? snap.val() : { compulsory: {}, subjectFees: {} }) }),
      onValue(ref(db, 'users'), snap => {
        const l = []
        snap.forEach(c => { const u = c.val(); l.push({ uid: c.key, ...u }) })
        l.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
        setUserAccounts(l)
      }),
    ]
    return () => uns.forEach(u => u())
  }, [])

  const fNum = s => formNum(s.classGrade)

  const filtered = students.filter(s => {
    const fn = fNum(s)
    if (formFilter !== 'All' && fn !== formFilter) return false
    if (classFilter !== 'All' && s.classGrade !== classFilter) return false
    if (statusFilter !== 'All' && s.enrollmentStatus !== statusFilter) return false
    const q = search.toLowerCase()
    return !q || s.fullName?.toLowerCase().includes(q) || s.studentId?.toLowerCase().includes(q) || s.classGrade?.toLowerCase().includes(q)
  })

  const stats = {
    total: students.length,
    active: students.filter(s => s.enrollmentStatus === 'Active').length,
    suspended: students.filter(s => s.enrollmentStatus === 'Suspended').length,
    outstanding: students.reduce((t, s) => t + Math.max(0, Number(s.feeBalance || 0)), 0),
  }

  const subjectCount = (key) => Object.keys(studentSubjects[key] || {}).length

  const subjectAvg = (key) => {
    const res = academicResults[key]
    if (!res) return null
    const subs = Object.keys(res)
    if (!subs.length || !assessments.length) return null
    const maxTotal = assessments.reduce((s, a) => s + (Number(a.outOf) || 0), 0)
    const totals = subs.map(sk => assessments.reduce((s, a) => { const v = Number(res[sk]?.[a.key]); return s + (isNaN(v) ? 0 : v) }, 0))
    const overall = totals.reduce((s, t) => s + t, 0) / (subs.length * maxTotal) * 100
    return Math.round(overall)
  }

  const gradeColor = (pct) => {
    if (pct >= 80) return 'text-emerald-600'
    if (pct >= 65) return 'text-blue-600'
    if (pct >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  // ─── Modals ───────────────────────────────────────────────────────────────
  const openNew = () => { setForm(BLANK); setModal('new') }
  const openEdit = (s) => { setForm(s); setModal('edit') }
  const openSubjects = (s) => { setSubjectStudent(s); setModal('subjects') }
  const openDetail = (s) => { setDetailStudent(s); setModal('detail') }

  const calcFees = (classKey) => {
    const compulsoryTotal = Object.values(feeStructure.compulsory || {})
      .reduce((s, f) => s + Number(f.amount || 0), 0)
    const classSubs = Object.keys(classSubjects[classKey] || {})
    const subjectTotal = classSubs.reduce((s, sk) => s + Number((feeStructure.subjectFees || {})[sk] || 0), 0)
    return compulsoryTotal + subjectTotal
  }

  const handleSave = async () => {
    setSaving(true)
    const cls = classes.find(c => c.key === form.classKey)
    const data = { ...form, classGrade: cls?.name || '' }

    const calculatedFee = form.classKey ? calcFees(form.classKey) : 0

    if (modal === 'new') {
      const studentId = generateStudentId()
      if (calculatedFee > 0) {
        data.termFee = calculatedFee
        data.feeBalance = calculatedFee
      }
      const r = push(ref(db, 'students'))
      await set(r, { ...data, studentId, createdAt: new Date().toISOString() })
      if (form.classKey && classSubjects[form.classKey]) {
        await set(ref(db, `studentSubjects/${r.key}`), classSubjects[form.classKey])
      }
      await logAction(currentUser, 'CREATE', 'student', { studentId, name: form.fullName })
    } else {
      const { key, ...rest } = data
      if (calculatedFee > 0) rest.termFee = calculatedFee
      await update(ref(db, `students/${form.key}`), rest)
      if (form.classKey && classSubjects[form.classKey]) {
        await set(ref(db, `studentSubjects/${form.key}`), classSubjects[form.classKey])
      }
      await logAction(currentUser, 'UPDATE', 'student', { name: form.fullName })
    }
    setModal(null); setSaving(false)
  }

  const handleDelete = async () => {
    const s = students.find(x => x.key === deleteKey)
    await remove(ref(db, `students/${deleteKey}`))
    await remove(ref(db, `studentSubjects/${deleteKey}`))
    await logAction(currentUser, 'DELETE', 'student', { name: s?.fullName })
    setDeleteKey(null)
  }

  const toggleSubject = async (subKey, currently) => {
    const path = `studentSubjects/${subjectStudent.key}/${subKey}`
    if (currently) await remove(ref(db, path)); else await set(ref(db, path), true)
  }

  const F = ({ label, name, type = 'text', options, fullWidth }) => (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {options ? (
        <select value={form[name] || ''} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0D3B66]">
          {options.map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={form[name] || ''} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0D3B66]" />
      )}
    </div>
  )

  const uniqueForms = [...new Set(students.map(fNum).filter(Boolean))].sort()

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Students', value: stats.total, bg: 'from-[#0D3B66] to-[#1a5290]' },
          { label: 'Active', value: stats.active, bg: 'from-emerald-500 to-emerald-600' },
          { label: 'Suspended', value: stats.suspended, bg: 'from-amber-500 to-amber-600' },
          { label: 'Fees Outstanding', value: `$${stats.outstanding.toFixed(2)}`, bg: 'from-red-500 to-red-600' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} text-white rounded-xl p-4 shadow-md`}>
            <p className="text-xs opacity-80 mb-0.5">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-[#0D3B66]">Student Records</h2>
        <button onClick={openNew} className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] shadow-sm">
          + Enrol Student
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-3 mb-5 flex flex-wrap gap-2">
        <input type="text" placeholder="Search by name, ID, class…" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-36 focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
        <select value={formFilter} onChange={e => setFormFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
          <option value="All">All Forms</option>
          {uniqueForms.map(f => <option key={f} value={f}>Form {f}</option>)}
        </select>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
          <option value="All">All Classes</option>
          {classes.map(c => <option key={c.key}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
          {['All', 'Active', 'Suspended', 'Withdrawn'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-400 self-center">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-400">No students match your search.</div>
        )}
        {filtered.map(s => {
          const fn = fNum(s)
          const avatarBg = FORM_COLORS[fn] || 'bg-slate-500'
          const tagStyle = FORM_LIGHT[fn] || 'bg-slate-100 text-slate-600 border-slate-200'
          const bal = Number(s.feeBalance || 0)
          const avg = subjectAvg(s.key)
          const sCount = subjectCount(s.key)

          return (
            <div key={s.key} className="bg-white rounded-xl shadow hover:shadow-lg transition-shadow border border-slate-100 overflow-hidden">
              {/* Top color strip by form */}
              <div className={`h-1.5 ${avatarBg}`} />
              <div className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`${avatarBg} text-white w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold shrink-0`}>
                    {s.fullName?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm leading-tight truncate">{s.fullName}</p>
                    <p className="text-xs text-slate-400 font-mono">{s.studentId}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border shrink-0 ${
                    s.enrollmentStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    s.enrollmentStatus === 'Suspended' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'
                  }`}>{s.enrollmentStatus}</span>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${tagStyle}`}>{s.classGrade}</span>
                  <span className="text-xs text-slate-500">{sCount} subject{sCount !== 1 ? 's' : ''}</span>
                  {avg !== null && (
                    <span className={`text-xs font-bold ml-auto ${gradeColor(avg)}`}>{avg}% avg</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">Fee balance</span>
                  <span className={`font-bold ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {bal < 0 ? `$${Math.abs(bal).toFixed(2)} CR` : `$${bal.toFixed(2)}`}
                    {bal === 0 && ' ✓'}
                  </span>
                </div>
                {s.guardianName && <p className="text-xs text-slate-400 truncate">Guardian: {s.guardianName}</p>}
                {s.healthAlerts && <p className="text-xs text-amber-600 mt-0.5 truncate">⚠ {s.healthAlerts}</p>}

                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button onClick={() => openDetail(s)} className="flex-1 text-xs text-[#0D3B66] font-semibold hover:bg-[#0D3B66] hover:text-white rounded py-1.5 border border-[#0D3B66] transition-colors">View</button>
                  <button onClick={() => openEdit(s)} className="flex-1 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded py-1.5 border border-slate-200 transition-colors">Edit</button>
                  <button onClick={() => openSubjects(s)} className="flex-1 text-xs text-violet-600 font-semibold hover:bg-violet-50 rounded py-1.5 border border-violet-200 transition-colors">Subjects</button>
                  <button onClick={() => setDeleteKey(s.key)} className="text-xs text-red-400 hover:text-red-600 px-2">✕</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail modal */}
      {modal === 'detail' && detailStudent && (() => {
        const s = detailStudent
        const res = academicResults[s.key] || {}
        const sKeys = Object.keys(studentSubjects[s.key] || {})
        const mySubs = subjects.filter(x => sKeys.includes(x.key))
        const maxTotal = assessments.reduce((t, a) => t + (Number(a.outOf) || 0), 0)

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className={`${FORM_COLORS[formNum(s.classGrade)] || 'bg-[#0D3B66]'} p-5 text-white`}>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">{s.fullName?.[0]}</div>
                  <div>
                    <h3 className="text-xl font-bold">{s.fullName}</h3>
                    <p className="text-sm opacity-80">{s.studentId} — {s.classGrade}</p>
                  </div>
                  <span className={`ml-auto text-xs px-3 py-1 rounded-full font-bold ${s.enrollmentStatus === 'Active' ? 'bg-emerald-400/30 text-emerald-100' : 'bg-red-400/30 text-red-100'}`}>{s.enrollmentStatus}</span>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 text-sm mb-5">
                  {[
                    ['Date of Birth', s.dateOfBirth], ['Guardian', s.guardianName],
                    ['Contact', s.guardianContact], ['Term Fee', `$${Number(s.termFee||0).toFixed(2)}`],
                    ['Fee Balance', Number(s.feeBalance||0) > 0 ? `$${Number(s.feeBalance).toFixed(2)} owing` : Number(s.feeBalance||0) < 0 ? `$${Math.abs(Number(s.feeBalance)).toFixed(2)} credit` : 'Fully Paid'],
                  ].map(([l, v]) => v ? (
                    <div key={l}><p className="text-xs text-slate-400">{l}</p><p className="font-medium">{v}</p></div>
                  ) : null)}
                  {s.healthAlerts && <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-2"><p className="text-xs text-amber-600 font-semibold">Health: {s.healthAlerts}</p></div>}
                </div>

                {/* Results summary */}
                <h4 className="font-bold text-[#0D3B66] mb-2 text-sm">Academic Results ({mySubs.length} subjects)</h4>
                {mySubs.length === 0 ? <p className="text-slate-400 text-sm">No subjects assigned.</p> : (
                  <div className="space-y-1.5">
                    {mySubs.map(sub => {
                      const subRes = res[sub.key] || {}
                      const total = assessments.reduce((t, a) => { const v = Number(subRes[a.key]); return t + (isNaN(v)?0:v) }, 0)
                      const pct = maxTotal > 0 && total > 0 ? Math.round((total/maxTotal)*100) : null
                      return (
                        <div key={sub.key} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 text-slate-700">{sub.name}</span>
                          {pct !== null ? (
                            <>
                              <span className="text-slate-500">{total}/{maxTotal}</span>
                              <span className={`font-bold w-10 text-right ${gradeColor(pct)}`}>{pct}%</span>
                            </>
                          ) : <span className="text-slate-300">—</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="px-5 pb-5 flex gap-2 justify-end">
                <button onClick={() => { openEdit(detailStudent); }} className="px-4 py-2 text-sm bg-[#0D3B66] text-white rounded-lg hover:bg-[#0a2f52]">Edit Student</button>
                <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add/Edit modal */}
      {(modal === 'new' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-[#0D3B66] mb-4">{modal === 'new' ? 'Enrol Student' : 'Edit Student'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Full Name" name="fullName" fullWidth />
              <F label="Date of Birth" name="dateOfBirth" type="date" />
              <F label="Class" name="classKey" options={[{ value: '', label: '— Select class —' }, ...classes.map(c => ({ value: c.key, label: c.name }))]} />
              <F label="Status" name="enrollmentStatus" options={['Active', 'Suspended', 'Withdrawn']} />
              <F label="Guardian Name" name="guardianName" />
              <F label="Guardian Contact" name="guardianContact" />
              <F label="Term Fee ($)" name="termFee" type="number" />
              <F label="Fee Balance ($)" name="feeBalance" type="number" />
              <F label="Academic Background" name="academicBackground" />
              <F label="Health Alerts" name="healthAlerts" />
              <F label="Link Parent Account" name="linkedParentUid"
                options={[{ value: '', label: '— None —' }, ...userAccounts.filter(u => u.role === 'parent').map(u => ({ value: u.uid, label: `${u.displayName || u.email} (${u.email})` }))]} />
              <F label="Link Student Account" name="linkedStudentUid"
                options={[{ value: '', label: '— None —' }, ...userAccounts.filter(u => u.role === 'student').map(u => ({ value: u.uid, label: `${u.displayName || u.email} (${u.email})` }))]} />
            </div>
            {form.classKey && classSubjects[form.classKey] && (
              <p className="text-xs text-emerald-600 mt-2">
                ✓ {Object.keys(classSubjects[form.classKey]).length} class subjects auto-assigned
                {calcFees(form.classKey) > 0 && ` · Term fee: $${calcFees(form.classKey).toFixed(2)}`}
              </p>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-[#0D3B66] text-white rounded-lg disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Subject modal */}
      {modal === 'subjects' && subjectStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
            <h3 className="font-bold text-[#0D3B66] mb-1">Subjects — {subjectStudent.fullName}</h3>
            <p className="text-xs text-slate-400 mb-3">{subjectStudent.classGrade}</p>
            <button onClick={() => { if(subjectStudent.classKey && classSubjects[subjectStudent.classKey]) set(ref(db, `studentSubjects/${subjectStudent.key}`), classSubjects[subjectStudent.classKey]) }} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded mb-3 hover:bg-slate-200">Reset to class defaults</button>
            <div className="space-y-1.5">
              {subjects.map(sub => {
                const checked = !!(studentSubjects[subjectStudent.key]?.[sub.key])
                return (
                  <label key={sub.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input type="checkbox" checked={checked} onChange={() => toggleSubject(sub.key, checked)} className="accent-[#0D3B66]" />
                    <span className="text-sm text-slate-700">{sub.name}</span>
                  </label>
                )
              })}
            </div>
            <button onClick={() => setModal(null)} className="mt-4 w-full border border-slate-300 rounded-lg py-2 text-sm text-slate-600 hover:bg-slate-50">Done</button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteKey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete Student?</h3>
            <p className="text-sm text-slate-600 mb-4">This permanently deletes the student record and cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteKey(null)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
