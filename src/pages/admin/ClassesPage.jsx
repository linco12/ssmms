import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, update, remove, set } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'
import { FORMS, SECTIONS, className } from '../../config/schoolConfig'

export default function ClassesPage() {
  const { currentUser } = useAuth()
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [classSubjects, setClassSubjects] = useState({})
  const [form, setForm] = useState(1)
  const [section, setSection] = useState('A')
  const [saving, setSaving] = useState(false)
  const [expandedKey, setExpandedKey] = useState(null)

  useEffect(() => {
    const u1 = onValue(ref(db, 'classes'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setClasses(list)
    })
    const u2 = onValue(ref(db, 'subjects'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => a.name.localeCompare(b.name))
      setSubjects(list)
    })
    const u3 = onValue(ref(db, 'users'), (snap) => {
      const list = []
      snap.forEach((c) => {
        const u = c.val()
        if (u.role === 'teacher') list.push({ uid: c.key, ...u })
      })
      setTeachers(list)
    })
    const u4 = onValue(ref(db, 'classSubjects'), (snap) => {
      setClassSubjects(snap.exists() ? snap.val() : {})
    })
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  const handleCreate = async () => {
    const name = className(form, section)
    if (classes.some((c) => c.name === name)) { alert(`${name} already exists.`); return }
    setSaving(true)
    const r = push(ref(db, 'classes'))
    await set(r, { name, form: Number(form), section, teacherUid: null, teacherName: null, createdAt: new Date().toISOString() })
    await logAction(currentUser, 'CREATE', 'class', { name })
    setSaving(false)
  }

  const assignTeacher = async (cls, teacherUid) => {
    const teacher = teachers.find((t) => t.uid === teacherUid)
    await update(ref(db, `classes/${cls.key}`), {
      teacherUid: teacherUid || null,
      teacherName: teacher?.displayName || null,
    })
    if (teacherUid) {
      await update(ref(db, `users/${teacherUid}`), { assignedClass: cls.name, assignedClassKey: cls.key })
    }
    await logAction(currentUser, 'UPDATE', 'class', { class: cls.name, assignedTeacher: teacher?.displayName })
  }

  const toggleSubject = async (classKey, subjectKey, currently) => {
    const path = `classSubjects/${classKey}/${subjectKey}`
    if (currently) {
      await remove(ref(db, path))
    } else {
      await set(ref(db, path), true)
    }
  }

  const deleteClass = async (cls) => {
    if (!confirm(`Delete class ${cls.name}? Students in this class will lose their class assignment.`)) return
    await remove(ref(db, `classes/${cls.key}`))
    await logAction(currentUser, 'DELETE', 'class', { name: cls.name })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">Classes</h2>
      <p className="text-sm text-slate-500 mb-5">Create classes, assign teachers, and set which subjects each class takes.</p>

      {/* Create class */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Form</label>
          <select value={form} onChange={(e) => setForm(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
            {FORMS.map((f) => <option key={f} value={f}>Form {f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
            {SECTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={handleCreate} disabled={saving}
          className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60">
          + Create {className(form, section)}
        </button>
      </div>

      {/* Classes list */}
      <div className="space-y-3">
        {classes.length === 0 && <p className="text-slate-400 text-sm">No classes yet. Create one above.</p>}
        {classes.map((cls) => {
          const assigned = classSubjects[cls.key] || {}
          const assignedCount = Object.keys(assigned).length
          const isOpen = expandedKey === cls.key

          return (
            <div key={cls.key} className="bg-white rounded-xl shadow">
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedKey(isOpen ? null : cls.key)}>
                <span className="font-bold text-[#0D3B66] w-20 shrink-0">{cls.name}</span>

                {/* Teacher assignment */}
                <select
                  value={cls.teacherUid || ''}
                  onChange={(e) => { e.stopPropagation(); assignTeacher(cls, e.target.value) }}
                  onClick={(e) => e.stopPropagation()}
                  className="border border-slate-200 rounded px-2 py-1 text-xs flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
                >
                  <option value="">— Assign teacher —</option>
                  {teachers.map((t) => <option key={t.uid} value={t.uid}>{t.displayName}</option>)}
                </select>

                <span className="text-xs text-slate-400 ml-auto shrink-0">{assignedCount} subject{assignedCount !== 1 ? 's' : ''}</span>
                <span className="text-xs text-[#0D3B66] shrink-0">{isOpen ? '▲ Hide' : '▼ Subjects'}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteClass(cls) }} className="text-red-400 hover:text-red-600 text-xs shrink-0">Delete</button>
              </div>

              {/* Subjects panel */}
              {isOpen && (
                <div className="border-t px-4 py-3">
                  <p className="text-xs font-medium text-slate-500 mb-2">Tick the subjects this class takes:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {subjects.map((sub) => {
                      const checked = !!assigned[sub.key]
                      return (
                        <label key={sub.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSubject(cls.key, sub.key, checked)}
                            className="accent-[#0D3B66]"
                          />
                          <span className="text-sm text-slate-700">{sub.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
