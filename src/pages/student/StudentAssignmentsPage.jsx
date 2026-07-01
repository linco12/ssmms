import { useEffect, useState, useRef } from 'react'
import { db, storage } from '../../firebase/config'
import { ref as dbRef, onValue, set, get } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../context/AuthContext'

const TYPE_LABELS = {
  text_questions:  { label: 'Text Questions',  icon: '📝' },
  multiple_choice: { label: 'Multiple Choice', icon: '🔘' },
  file_upload:     { label: 'File Upload',     icon: '📎' },
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

function statusInfo(deadline, submitted) {
  if (submitted) return { label: '✓ Submitted', cls: 'bg-emerald-100 text-emerald-700' }
  if (!deadline) return { label: 'No Deadline', cls: 'bg-slate-100 text-slate-500' }
  const d = new Date(deadline)
  const now = new Date()
  if (d < now) return { label: 'Overdue', cls: 'bg-red-100 text-red-700' }
  const hoursLeft = (d - now) / 3600000
  if (hoursLeft < 48) return { label: `Due in ${Math.ceil(hoursLeft)}h`, cls: 'bg-amber-100 text-amber-700' }
  return { label: `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, cls: 'bg-blue-100 text-blue-700' }
}

export default function StudentAssignmentsPage() {
  const { currentUser } = useAuth()

  const [studentClassKey, setStudentClassKey] = useState(null)
  const [loadingClass, setLoadingClass]       = useState(true)
  const [assignments, setAssignments]         = useState([])
  const [mySubmissions, setMySubmissions]     = useState({}) // { [assignmentKey]: submissionObj }
  const [filter, setFilter]                   = useState('all') // 'all' | 'pending' | 'submitted' | 'overdue'
  const [selected, setSelected]               = useState(null) // selected assignment
  const [answers, setAnswers]                 = useState({})   // { [qid]: value }
  const [uploadFile, setUploadFile]           = useState(null)
  const [submitting, setSubmitting]           = useState(false)
  const [submitError, setSubmitError]         = useState('')
  const fileRef = useRef(null)

  // ── Step 1: find student's classKey by their UID ─────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return
    get(dbref(db, 'ssmms/students')).then(snap => {
      snap.forEach(c => {
        const s = c.val()
        if (s.linkedStudentUid === currentUser.uid) {
          setStudentClassKey(s.classKey || null)
        }
      })
      setLoadingClass(false)
    })
  }, [currentUser?.uid])

  // ── Step 2: load assignments for student's class ──────────────────────────
  useEffect(() => {
    if (!studentClassKey) return
    return onValue(dbref(db, 'ssmms/assignments'), snap => {
      const list = []
      snap.forEach(c => {
        const a = c.val()
        if (a.classKey === studentClassKey && a.status !== 'closed') {
          list.push({ key: c.key, ...a })
        }
      })
      list.sort((a, b) => {
        // Sort: pending first (by deadline), then submitted
        const aSub = !!mySubmissions[a.key]
        const bSub = !!mySubmissions[b.key]
        if (aSub !== bSub) return aSub ? 1 : -1
        const aD = a.deadline ? new Date(a.deadline) : new Date('9999')
        const bD = b.deadline ? new Date(b.deadline) : new Date('9999')
        return aD - bD
      })
      setAssignments(list)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentClassKey])

  // ── Step 3: load my submissions ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return
    // Listen to all assignment submissions to find my own entries
    return onValue(dbref(db, 'ssmms/assignmentSubmissions'), snap => {
      const subs = {}
      snap.forEach(aSnap => {
        const mySub = aSnap.child(currentUser.uid)
        if (mySub.exists()) subs[aSnap.key] = mySub.val()
      })
      setMySubmissions(subs)
    })
  }, [currentUser?.uid])

  // ── When selected assignment changes, reset answer state ─────────────────
  useEffect(() => {
    if (!selected) return
    const existing = mySubmissions[selected.key]
    if (existing?.answers) {
      setAnswers(existing.answers)
    } else {
      setAnswers({})
    }
    setUploadFile(null)
    setSubmitError('')
  }, [selected, mySubmissions])

  const isSubmitted = (key) => !!mySubmissions[key]

  // ── Filter assignments ────────────────────────────────────────────────────
  const filtered = assignments.filter(a => {
    if (filter === 'all') return true
    if (filter === 'submitted') return isSubmitted(a.key)
    if (filter === 'pending') {
      const sub = isSubmitted(a.key)
      const overdue = a.deadline && new Date(a.deadline) < new Date()
      return !sub && !overdue
    }
    if (filter === 'overdue') {
      return !isSubmitted(a.key) && a.deadline && new Date(a.deadline) < new Date()
    }
    return true
  })

  // ── Submit answer ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selected || isSubmitted(selected.key)) return
    setSubmitError('')

    // Validate
    if (selected.type !== 'file_upload') {
      const questions = selected.questions || {}
      const unanswered = Object.keys(questions).filter(qid => !answers[qid]?.toString().trim())
      if (unanswered.length > 0) {
        return setSubmitError('Please answer all questions before submitting.')
      }
    } else {
      if (!uploadFile) return setSubmitError('Please select a file to upload.')
    }

    setSubmitting(true)
    try {
      const submissionRef = dbRef(db, `assignmentSubmissions/${selected.key}/${currentUser.uid}`)

      let fileUrl = null
      let fileName = null
      if (selected.type === 'file_upload' && uploadFile) {
        const sRef = storageRef(storage, `assignmentSubmissions/${selected.key}/${currentUser.uid}/${uploadFile.name}`)
        const snap = await uploadBytes(sRef, uploadFile)
        fileUrl = await getDownloadURL(snap.ref)
        fileName = uploadFile.name
      }

      await set(submissionRef, {
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        ...(selected.type !== 'file_upload' ? { answers } : {}),
        ...(fileUrl ? { fileUrl, fileName } : {}),
      })
      // Submission recorded; UI will update via onValue listener
    } catch {
      setSubmitError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loadingClass) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center text-slate-400">
          <div className="text-3xl mb-2">📚</div>
          <p>Loading assignments…</p>
        </div>
      </div>
    )
  }

  if (!studentClassKey) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <p className="text-amber-700 font-medium">You are not currently enrolled in a class.</p>
        <p className="text-amber-600 text-sm mt-1">Please contact your administrator.</p>
      </div>
    )
  }

  // ── Detail / submission view ──────────────────────────────────────────────
  if (selected) {
    const submission = mySubmissions[selected.key]
    const alreadySubmitted = !!submission
    const deadline = selected.deadline ? new Date(selected.deadline) : null
    const overdue  = deadline && deadline < new Date() && !alreadySubmitted
    const questions = selected.questions
      ? Object.entries(selected.questions).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
      : []

    return (
      <div>
        <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-[#0D3B66] text-sm font-medium mb-4 flex items-center gap-1">
          ← Back to Assignments
        </button>

        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{selected.title}</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                {selected.teacherName} · {selected.className} · {TYPE_LABELS[selected.type]?.icon} {TYPE_LABELS[selected.type]?.label}
              </p>
            </div>
            <div>
              {(() => { const s = statusInfo(selected.deadline, alreadySubmitted); return <span className={`text-xs font-bold px-3 py-1 rounded-full ${s.cls}`}>{s.label}</span> })()}
            </div>
          </div>
          {selected.description && (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-3">{selected.description}</p>
          )}
          {deadline && (
            <p className={`text-sm font-medium ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
              ⏰ Deadline: {deadline.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {selected.attachmentUrl && (
            <a href={selected.attachmentUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#0D3B66] font-semibold bg-blue-50 px-3 py-2 rounded hover:bg-blue-100 transition-colors">
              📎 Download Assignment PDF / File
            </a>
          )}
        </div>

        {/* Already submitted banner */}
        {alreadySubmitted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-emerald-700">Assignment submitted</p>
              <p className="text-sm text-emerald-600">
                Submitted on {new Date(submission.submittedAt).toLocaleString('en-GB')}. You cannot change your submission.
              </p>
              {submission.grade && (
                <p className="text-sm font-bold text-emerald-700 mt-1">Grade: {submission.grade}</p>
              )}
              {submission.feedback && (
                <p className="text-sm text-emerald-600 mt-0.5">Teacher feedback: {submission.feedback}</p>
              )}
            </div>
          </div>
        )}

        {/* Overdue banner */}
        {overdue && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="font-semibold text-red-700">⚠ This assignment is past its deadline.</p>
            <p className="text-sm text-red-500">You may still submit but it will be marked as late.</p>
          </div>
        )}

        {/* Answer form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <h4 className="font-semibold text-slate-700">
            {alreadySubmitted ? 'Your Answers' : 'Your Submission'}
          </h4>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{submitError}</div>
          )}

          {/* Text questions */}
          {selected.type === 'text_questions' && questions.map(([qid, q], idx) => (
            <div key={qid}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {idx + 1}. {q.text}
              </label>
              <textarea
                value={answers[qid] || ''}
                onChange={e => !alreadySubmitted && setAnswers(prev => ({ ...prev, [qid]: e.target.value }))}
                disabled={alreadySubmitted}
                placeholder="Type your answer here…"
                rows={3}
                className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none
                  ${alreadySubmitted ? 'bg-slate-50 text-slate-600 cursor-default' : 'bg-white'}`}
              />
            </div>
          ))}

          {/* Multiple choice */}
          {selected.type === 'multiple_choice' && questions.map(([qid, q], idx) => (
            <div key={qid} className="border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">{idx + 1}. {q.text}</p>
              <div className="space-y-2">
                {(q.options || []).map((opt, oi) => {
                  if (!opt.trim()) return null
                  const label = OPTION_LABELS[oi]
                  const isSelected = answers[qid] === label
                  const isCorrect  = alreadySubmitted && q.correctAnswer && label === q.correctAnswer
                  const isWrong    = alreadySubmitted && q.correctAnswer && isSelected && label !== q.correctAnswer
                  return (
                    <label key={oi}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all
                        ${isCorrect ? 'border-emerald-400 bg-emerald-50' :
                          isWrong   ? 'border-red-400 bg-red-50' :
                          isSelected ? 'border-[#0D3B66] bg-blue-50' :
                          alreadySubmitted ? 'border-slate-100 bg-slate-50 cursor-default' :
                          'border-slate-200 hover:border-[#0D3B66]'}`}>
                      <input type="radio"
                        name={`q_${qid}`}
                        value={label}
                        checked={isSelected}
                        onChange={() => !alreadySubmitted && setAnswers(prev => ({ ...prev, [qid]: label }))}
                        disabled={alreadySubmitted}
                        className="accent-[#0D3B66]" />
                      <span className="text-xs font-bold text-slate-500 w-5">{label}</span>
                      <span className="text-sm text-slate-700 flex-1">{opt}</span>
                      {isCorrect && <span className="text-xs text-emerald-600 font-bold">✓ Correct</span>}
                      {isWrong   && <span className="text-xs text-red-600 font-bold">✗ Wrong</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {/* File upload */}
          {selected.type === 'file_upload' && (
            <div>
              {alreadySubmitted && submission?.fileUrl ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-emerald-700 mb-2">File submitted:</p>
                  <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#0D3B66] font-semibold bg-blue-50 px-3 py-2 rounded hover:bg-blue-100">
                    📎 {submission.fileName || 'View submitted file'}
                  </a>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-600 mb-3">Upload your completed assignment file (PDF, Word, image, etc.)</p>
                  <input type="file" ref={fileRef}
                    onChange={e => setUploadFile(e.target.files[0] || null)}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                    className="hidden" />
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-lg px-6 py-4 text-sm text-slate-500 hover:border-[#0D3B66] hover:text-[#0D3B66] transition-colors">
                      📂 Choose file to upload
                    </button>
                    {uploadFile && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-emerald-600 font-medium">📎 {uploadFile.name}</span>
                        <button type="button" onClick={() => { setUploadFile(null); fileRef.current.value = '' }}
                          className="text-red-400 hover:text-red-600 text-lg">×</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit button */}
          {!alreadySubmitted && (
            <div className="pt-2 border-t border-slate-100">
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-[#0D3B66] text-white rounded-lg py-3 text-sm font-bold hover:bg-[#0a2f52] disabled:opacity-60 transition-colors">
                {submitting ? 'Submitting…' : '📤 Submit Assignment'}
              </button>
              <p className="text-xs text-slate-400 text-center mt-2">
                Once submitted, you cannot change your answers.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">My Assignments</h2>
      <p className="text-sm text-slate-400 mb-4">Assignments and homework posted by your teachers</p>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['all', 'All'], ['pending', 'Pending'], ['overdue', 'Overdue'], ['submitted', 'Submitted']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${filter === val ? 'bg-[#0D3B66] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#0D3B66]'}`}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-3xl mb-2">📚</p>
          <p className="text-slate-500 font-medium">
            {filter === 'all' ? 'No assignments yet' : `No ${filter} assignments`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const submitted = isSubmitted(a.key)
            const s = statusInfo(a.deadline, submitted)
            const submission = mySubmissions[a.key]
            return (
              <div key={a.key}
                className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-[#0D3B66] transition-colors group"
                onClick={() => setSelected(a)}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                    {TYPE_LABELS[a.type]?.icon || '📝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 group-hover:text-[#0D3B66]">{a.title}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.teacherName} · {TYPE_LABELS[a.type]?.label}
                    </p>
                    {submission?.grade && (
                      <span className="inline-block mt-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Grade: {submission.grade}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-300 group-hover:text-slate-500 text-lg flex-shrink-0">›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
