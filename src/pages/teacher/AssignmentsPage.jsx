import { useEffect, useState, useRef } from 'react'
import { db, storage } from '../../firebase/config'
import { ref as dbRef, onValue, push, set, update } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../context/AuthContext'

const TYPE_LABELS = {
  text_questions:  { label: 'Text Questions',  icon: '📝', desc: 'Students type their answers' },
  multiple_choice: { label: 'Multiple Choice', icon: '🔘', desc: 'Students select the correct option' },
  file_upload:     { label: 'File Upload',     icon: '📎', desc: 'Students upload their completed work' },
}

function Badge({ type }) {
  const map = { text_questions: 'bg-blue-100 text-blue-700', multiple_choice: 'bg-purple-100 text-purple-700', file_upload: 'bg-amber-100 text-amber-700' }
  const t = TYPE_LABELS[type] || { icon: '?', label: type }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${map[type] || 'bg-slate-100 text-slate-600'}`}>{t.icon} {t.label}</span>
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null
  const d = new Date(deadline)
  const now = new Date()
  const overdue = d < now
  const soon = !overdue && (d - now) < 86400000 * 2
  const cls = overdue ? 'text-red-600 bg-red-50' : soon ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-50'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {overdue ? '⚠ Overdue' : '⏰'} {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

// ─── Empty question templates ────────────────────────────────────────────────
function emptyQuestion(type) {
  return { id: `q${Date.now()}${Math.random()}`, text: '', options: ['', '', '', ''], correctAnswer: '' }
}

function emptyForm(userProfile) {
  return {
    title: '', description: '',
    classKey: userProfile?.assignedClassKey || '',
    className: userProfile?.assignedClass || '',
    type: 'text_questions', deadline: '',
    questions: [emptyQuestion('text_questions')],
  }
}

// ─── Submission row ──────────────────────────────────────────────────────────
function SubmissionRow({ student, submission, assignment, onGrade }) {
  const sub = submission
  const [grade, setGrade] = useState(sub?.grade || '')
  const [feedback, setFeedback] = useState(sub?.feedback || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await update(dbRef(db, `assignmentSubmissions/${assignment.key}/${student.linkedStudentUid || ''}`), { grade, feedback })
    setSaving(false)
    onGrade?.()
  }

  if (!sub) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold flex-shrink-0">
          {(student.firstName || student.name || '?')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 text-sm">{student.firstName} {student.lastName}</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">Not submitted</span>
      </div>
    )
  }

  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#0D3B66] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {(student.firstName || student.name || '?')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-medium text-slate-800 text-sm">{student.firstName} {student.lastName}</p>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">✓ Submitted</span>
            <span className="text-xs text-slate-400">{sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('en-GB') : ''}</span>
          </div>

          {/* Answers */}
          {assignment.type !== 'file_upload' && sub.answers && Object.entries(sub.answers).map(([qid, answer]) => {
            const question = assignment.questions?.[qid]
            if (!question) return null
            const isCorrect = question.type === 'mcq' && question.correctAnswer && answer === question.correctAnswer
            const isWrong   = question.type === 'mcq' && question.correctAnswer && answer !== question.correctAnswer
            return (
              <div key={qid} className="mb-2 bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-500 mb-1">{question.text}</p>
                <p className={`text-sm font-medium ${isCorrect ? 'text-emerald-700' : isWrong ? 'text-red-600' : 'text-slate-700'}`}>
                  {isCorrect ? '✓ ' : isWrong ? '✗ ' : ''}{answer || '—'}
                  {isWrong && <span className="text-xs ml-2 text-emerald-600">Correct: {question.correctAnswer}</span>}
                </p>
              </div>
            )
          })}

          {/* File submission */}
          {assignment.type === 'file_upload' && sub.fileUrl && (
            <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#0D3B66] font-semibold bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100 transition-colors">
              📎 View submitted file: {sub.fileName || 'Download'}
            </a>
          )}

          {/* Grade / feedback */}
          <div className="flex gap-2 mt-2">
            <input value={grade} onChange={e => setGrade(e.target.value)} placeholder="Grade (e.g. A, 85%)"
              className="border border-slate-300 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-[#0D3B66]" />
            <input value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback (optional)"
              className="border border-slate-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-[#0D3B66]" />
            <button onClick={handleSave} disabled={saving}
              className="bg-[#0D3B66] text-white text-xs px-3 py-1 rounded hover:bg-[#0a2f52] disabled:opacity-60">
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function TeacherAssignmentsPage() {
  const { currentUser, userProfile } = useAuth()

  const [view, setView] = useState('list') // 'list' | 'create' | 'submissions'
  const [assignments, setAssignments] = useState([])
  const [classes, setClasses]         = useState([])
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [submissions, setSubmissions] = useState({})
  const [classStudents, setClassStudents] = useState([])

  // Create form
  const [form, setForm] = useState(() => emptyForm(userProfile))
  const [attachment, setAttachment]   = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState('')
  const fileInputRef = useRef(null)

  // ── Load assignments (only mine) ──────────────────────────────────────────
  useEffect(() => {
    return onValue(dbRef(db, 'assignments'), snap => {
      const list = []
      snap.forEach(c => {
        const a = c.val()
        if (a.teacherId === currentUser?.uid) list.push({ key: c.key, ...a })
      })
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setAssignments(list)
    })
  }, [currentUser?.uid])

  // ── Load all classes ──────────────────────────────────────────────────────
  useEffect(() => {
    return onValue(dbRef(db, 'classes'), snap => {
      const list = []
      snap.forEach(c => list.push({ key: c.key, ...c.val() }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setClasses(list)
    })
  }, [])

  // ── Load submissions + students when viewing a specific assignment ─────────
  useEffect(() => {
    if (!selectedAssignment) return
    const u1 = onValue(dbRef(db, `assignmentSubmissions/${selectedAssignment.key}`), snap => {
      setSubmissions(snap.val() || {})
    })
    const u2 = onValue(dbRef(db, 'students'), snap => {
      const list = []
      snap.forEach(c => {
        const s = c.val()
        if (s.classKey === selectedAssignment.classKey) list.push({ key: c.key, ...s })
      })
      list.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))
      setClassStudents(list)
    })
    return () => { u1(); u2() }
  }, [selectedAssignment])

  // ── Form helpers ─────────────────────────────────────────────────────────
  const setFormField = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleClassChange = (e) => {
    const cl = classes.find(c => c.key === e.target.value)
    setForm(f => ({ ...f, classKey: e.target.value, className: cl?.name || '' }))
  }

  const addQuestion = () => {
    setForm(f => ({ ...f, questions: [...f.questions, emptyQuestion(f.type)] }))
  }

  const removeQuestion = (idx) => {
    setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }))
  }

  const updateQuestion = (idx, field, value) => {
    setForm(f => {
      const qs = [...f.questions]
      if (field.startsWith('opt_')) {
        const optIdx = parseInt(field.split('_')[1])
        const opts = [...(qs[idx].options || ['', '', '', ''])]
        opts[optIdx] = value
        qs[idx] = { ...qs[idx], options: opts }
      } else {
        qs[idx] = { ...qs[idx], [field]: value }
      }
      return { ...f, questions: qs }
    })
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.title.trim()) return setError('Please enter a title.')
    if (!form.classKey)     return setError('Please select a class.')
    if (!form.deadline)     return setError('Please set a deadline.')
    if (form.type !== 'file_upload' && form.questions.every(q => !q.text.trim())) {
      return setError('Please add at least one question.')
    }

    setSaving(true)
    try {
      const newRef = push(dbRef(db, 'assignments'))
      const assignmentId = newRef.key

      let attachmentUrl = null
      let attachmentName = null

      if (attachment) {
        setUploading(true)
        const sRef = storageRef(storage, `assignmentAttachments/${assignmentId}/${attachment.name}`)
        const snap = await uploadBytes(sRef, attachment)
        attachmentUrl = await getDownloadURL(snap.ref)
        attachmentName = attachment.name
        setUploading(false)
      }

      // Build questions map (skip empty questions)
      const questionsMap = {}
      if (form.type !== 'file_upload') {
        form.questions.forEach((q, i) => {
          if (!q.text.trim()) return
          const qId = q.id || `q${i}`
          questionsMap[qId] = {
            text: q.text.trim(),
            type: form.type === 'multiple_choice' ? 'mcq' : 'text',
            order: i,
            ...(form.type === 'multiple_choice' ? {
              options: q.options.filter(o => o.trim()),
              correctAnswer: q.correctAnswer || '',
            } : {}),
          }
        })
      }

      await set(newRef, {
        title:       form.title.trim(),
        description: form.description.trim(),
        classKey:    form.classKey,
        className:   form.className,
        type:        form.type,
        deadline:    new Date(form.deadline).toISOString(),
        teacherId:   currentUser.uid,
        teacherName: userProfile?.displayName || currentUser.displayName || 'Teacher',
        createdAt:   new Date().toISOString(),
        questions:   questionsMap,
        status:      'active',
        ...(attachmentUrl ? { attachmentUrl, attachmentName } : {}),
      })

      setSaved(true)
      setForm(emptyForm(userProfile))
      setAttachment(null)
      setTimeout(() => { setSaved(false); setView('list') }, 1800)
    } catch (err) {
      setError('Failed to save assignment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const openSubmissions = (assignment) => {
    setSelectedAssignment(assignment)
    setView('submissions')
  }

  const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header + tabs */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#0D3B66]">Assignments</h2>
          <p className="text-sm text-slate-400">Create and manage class assignments and homework</p>
        </div>
        {view !== 'create' && (
          <button onClick={() => { setView('create'); setForm(emptyForm(userProfile)); setError('') }}
            className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] transition-colors">
            + New Assignment
          </button>
        )}
        {view !== 'list' && (
          <button onClick={() => { setView('list'); setSelectedAssignment(null) }}
            className="text-slate-500 hover:text-[#0D3B66] text-sm font-medium">
            ← Back to list
          </button>
        )}
      </div>

      {/* ── LIST VIEW ───────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="mt-4">
          {assignments.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-3xl mb-3">📝</p>
              <p className="text-slate-500 font-medium">No assignments yet</p>
              <p className="text-slate-400 text-sm mt-1">Click "New Assignment" to create your first one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const subCount = 0 // could precompute; submissions loaded on detail view
                const now = new Date()
                const deadline = a.deadline ? new Date(a.deadline) : null
                const isPast = deadline && deadline < now
                return (
                  <div key={a.key}
                    className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4 hover:border-[#0D3B66] transition-colors cursor-pointer group"
                    onClick={() => openSubmissions(a)}>
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                      {TYPE_LABELS[a.type]?.icon || '📝'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 group-hover:text-[#0D3B66]">{a.title}</p>
                        <Badge type={a.type} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">🏫 {a.className}</span>
                        <DeadlineBadge deadline={a.deadline} />
                        {isPast && <span className="text-xs text-slate-400">Deadline passed</span>}
                      </div>
                      {a.description && <p className="text-sm text-slate-400 mt-1 truncate">{a.description}</p>}
                    </div>
                    <span className="text-slate-300 group-hover:text-slate-500 text-lg">›</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUBMISSIONS VIEW ─────────────────────────────────────────── */}
      {view === 'submissions' && selectedAssignment && (
        <div className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 text-lg">{selectedAssignment.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge type={selectedAssignment.type} />
                  <span className="text-xs text-slate-500">🏫 {selectedAssignment.className}</span>
                  <DeadlineBadge deadline={selectedAssignment.deadline} />
                </div>
                {selectedAssignment.description && (
                  <p className="text-sm text-slate-500 mt-2">{selectedAssignment.description}</p>
                )}
              </div>
              {selectedAssignment.attachmentUrl && (
                <a href={selectedAssignment.attachmentUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#0D3B66] font-semibold bg-blue-50 px-3 py-2 rounded hover:bg-blue-100">
                  📎 View Attachment
                </a>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-[#0D3B66]">{Object.keys(submissions).length}</p>
                <p className="text-xs text-slate-500">Submitted</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-400">{Math.max(0, classStudents.length - Object.keys(submissions).length)}</p>
                <p className="text-xs text-slate-500">Pending</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-700 mb-3 text-sm">Student Submissions ({classStudents.length} students)</h4>
            {classStudents.length === 0 && (
              <p className="text-slate-400 text-sm py-4 text-center">No students found in this class.</p>
            )}
            {classStudents.map(student => (
              <SubmissionRow
                key={student.key}
                student={student}
                submission={submissions[student.linkedStudentUid]}
                assignment={selectedAssignment}
                onGrade={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── CREATE VIEW ──────────────────────────────────────────────── */}
      {view === 'create' && (
        <div className="mt-4 max-w-2xl">
          {saved && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 mb-4 text-sm">
              ✓ Assignment posted! Students will be notified.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Assignment Title <span className="text-red-500">*</span></label>
              <input value={form.title} onChange={e => setFormField('title', e.target.value)}
                placeholder="e.g. Chapter 3 Review Questions"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Instructions / Description</label>
              <textarea value={form.description} onChange={e => setFormField('description', e.target.value)}
                placeholder="Describe what students need to do…" rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none" />
            </div>

            {/* Class + Deadline */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Class <span className="text-red-500">*</span></label>
                <select value={form.classKey} onChange={handleClassChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] bg-white">
                  <option value="">— Select class —</option>
                  {classes.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Deadline <span className="text-red-500">*</span></label>
                <input type="datetime-local" value={form.deadline} onChange={e => setFormField('deadline', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>
            </div>

            {/* Type selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Assignment Type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(TYPE_LABELS).map(([key, meta]) => (
                  <button key={key} type="button" onClick={() => setFormField('type', key)}
                    className={`border-2 rounded-lg p-3 text-left transition-all ${form.type === key ? 'border-[#0D3B66] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="text-xl mb-1">{meta.icon}</div>
                    <div className="text-xs font-bold text-slate-700">{meta.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{meta.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* PDF Attachment (optional for all types) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {form.type === 'file_upload' ? 'Assignment PDF (brief/instructions)' : 'Attach PDF (optional)'}
              </label>
              <div className="flex items-center gap-3">
                <input type="file" ref={fileInputRef} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={e => setAttachment(e.target.files[0] || null)} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-600 hover:border-[#0D3B66] hover:text-[#0D3B66] transition-colors">
                  📎 Choose File
                </button>
                {attachment && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{attachment.name}</span>
                    <button type="button" onClick={() => { setAttachment(null); fileInputRef.current.value = '' }}
                      className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  </div>
                )}
                {!attachment && <span className="text-xs text-slate-400">PDF, Word, or image</span>}
              </div>
            </div>

            {/* Questions builder (text and MCQ types) */}
            {form.type !== 'file_upload' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">Questions <span className="text-red-500">*</span></label>
                  <button type="button" onClick={addQuestion}
                    className="text-xs text-[#0D3B66] font-semibold hover:underline">+ Add question</button>
                </div>
                <div className="space-y-4">
                  {form.questions.map((q, idx) => (
                    <div key={q.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="text-xs font-bold text-slate-400 mt-2 w-6 flex-shrink-0">Q{idx + 1}</span>
                        <textarea value={q.text} onChange={e => updateQuestion(idx, 'text', e.target.value)}
                          placeholder="Enter question…" rows={2}
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none bg-white" />
                        {form.questions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(idx)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none mt-1 flex-shrink-0">×</button>
                        )}
                      </div>

                      {/* MCQ options */}
                      {form.type === 'multiple_choice' && (
                        <div className="ml-8 space-y-2">
                          {(q.options || ['', '', '', '']).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input type="radio"
                                name={`correct_${q.id}`}
                                checked={q.correctAnswer === OPTION_LABELS[oi]}
                                onChange={() => updateQuestion(idx, 'correctAnswer', OPTION_LABELS[oi])}
                                className="accent-[#0D3B66] flex-shrink-0" title="Mark as correct answer" />
                              <span className="text-xs font-bold text-slate-500 w-5 flex-shrink-0">{OPTION_LABELS[oi]}</span>
                              <input value={opt} onChange={e => updateQuestion(idx, `opt_${oi}`, e.target.value)}
                                placeholder={`Option ${OPTION_LABELS[oi]}`}
                                className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0D3B66] bg-white" />
                            </div>
                          ))}
                          <p className="text-xs text-slate-400 ml-7">Click the circle to mark the correct answer</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <button onClick={handleSubmit} disabled={saving || uploading}
              className="w-full bg-[#0D3B66] text-white rounded-lg py-3 text-sm font-bold hover:bg-[#0a2f52] disabled:opacity-60 transition-colors">
              {uploading ? 'Uploading file…' : saving ? 'Posting…' : '📤 Post Assignment'}
            </button>
            <p className="text-xs text-slate-400 text-center">
              Students in the selected class will receive a push notification when this is posted.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
