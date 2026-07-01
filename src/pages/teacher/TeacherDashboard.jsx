import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, set } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import AnnouncementsSection from '../../components/AnnouncementsSection'
import { useFeatureFlags } from '../../context/FeatureFlagsContext'

const BLANK_STUDENT = { fullName: '', gender: '', enrollmentStatus: 'Active' }

export default function TeacherDashboard() {
  const { userProfile, currentUser } = useAuth()
  const { isEnabled } = useFeatureFlags()
  const [students, setStudents]       = useState([])
  const [addModal, setAddModal]       = useState(false)
  const [form, setForm]               = useState(BLANK_STUDENT)
  const [saving, setSaving]           = useState(false)
  const [addMsg, setAddMsg]           = useState('')

  const assignedClass = userProfile?.assignedClass || null
  const canAddStudents = isEnabled('priv_teacher_add_students')

  useEffect(() => {
    return onValue(ref(db, 'ssmms/students'), (snap) => {
      const list = []
      snap.forEach((c) => {
        const s = c.val()
        if (!assignedClass || s.classGrade === assignedClass) list.push({ key: c.key, ...s })
      })
      setStudents(list)
    })
  }, [assignedClass])

  const handleAddStudent = async () => {
    if (!form.fullName.trim()) { setAddMsg('error:Student name is required.'); return }
    setSaving(true)
    setAddMsg('')
    try {
      const newRef = push(ref(db, 'ssmms/students'))
      await set(newRef, {
        fullName: form.fullName.trim(),
        gender: form.gender || '',
        classGrade: assignedClass || '',
        enrollmentStatus: 'Active',
        addedByTeacher: currentUser.uid,
        createdAt: new Date().toISOString(),
      })
      setAddMsg(`success:${form.fullName.trim()} added to ${assignedClass}.`)
      setForm(BLANK_STUDENT)
    } catch {
      setAddMsg('error:Failed to add student. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const isError   = addMsg.startsWith('error:')
  const isSuccess = addMsg.startsWith('success:')
  const msgText   = addMsg.replace(/^(error|success):/, '')

  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-2xl font-bold text-[#0D3B66]">Teacher Dashboard</h1>
        {canAddStudents && assignedClass && (
          <button onClick={() => { setAddModal(true); setAddMsg(''); setForm(BLANK_STUDENT) }}
            className="bg-[#0D3B66] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0a2f52]">
            + Add Student
          </button>
        )}
      </div>
      {assignedClass && (
        <p className="text-sm text-slate-500 mb-4">Assigned class: <span className="font-semibold">{assignedClass}</span></p>
      )}
      <AnnouncementsSection />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#0D3B66] text-white rounded-xl p-5 shadow">
          <p className="text-sm opacity-80">Students in My Class</p>
          <p className="text-3xl font-bold">{students.length}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/teacher/results" className="bg-white rounded-lg shadow p-4 text-[#0D3B66] font-semibold text-sm hover:bg-[#0D3B66] hover:text-white transition-colors text-center border border-slate-100">
          Results & Grades
        </Link>
        <Link to="/teacher/attendance" className="bg-white rounded-lg shadow p-4 text-[#0D3B66] font-semibold text-sm hover:bg-[#0D3B66] hover:text-white transition-colors text-center border border-slate-100">
          Attendance
        </Link>
      </div>

      {/* ── Add Student Modal ──────────────────────────────── */}
      {addModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-[#0D3B66] mb-1">Add Student to {assignedClass}</h3>
            <p className="text-xs text-slate-400 mb-4">This creates a student profile in your class. Login credentials must be set by the admin.</p>

            {addMsg && (
              <div className={`rounded-lg px-3 py-2.5 text-sm mb-3 ${isError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                {msgText}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="e.g. Tafara Gumbo"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
                  <option value="">— Select —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => { setAddModal(false); setAddMsg('') }} disabled={saving}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50">
                {isSuccess ? 'Close' : 'Cancel'}
              </button>
              {isSuccess ? (
                <button onClick={() => { setForm(BLANK_STUDENT); setAddMsg('') }}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
                  + Add Another
                </button>
              ) : (
                <button onClick={handleAddStudent} disabled={saving || !form.fullName.trim()}
                  className="flex-1 px-4 py-2 bg-[#0D3B66] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60">
                  {saving ? 'Adding…' : 'Add Student'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
