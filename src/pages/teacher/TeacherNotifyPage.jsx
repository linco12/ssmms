import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'

export default function TeacherNotifyPage() {
  const { currentUser, userProfile } = useAuth()

  const [classes, setClasses]   = useState([])
  const [students, setStudents] = useState([])
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [targetType, setTargetType] = useState('class') // 'class' | 'student'
  const [classKey, setClassKey] = useState(userProfile?.assignedClassKey || '')
  const [className, setClassName] = useState(userProfile?.assignedClass || '')
  const [targetUid, setTargetUid] = useState('')
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState('')
  const [history, setHistory]   = useState([])

  useEffect(() => {
    const u1 = onValue(ref(db, 'classes'), snap => {
      const list = []
      snap.forEach(c => list.push({ key: c.key, ...c.val() }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setClasses(list)
    })
    // Load notification history sent by this teacher
    const u2 = onValue(ref(db, 'targetedNotifications'), snap => {
      const list = []
      snap.forEach(c => {
        const n = c.val()
        if (n.sentBy === currentUser?.uid) list.push({ key: c.key, ...n })
      })
      list.sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''))
      setHistory(list.slice(0, 20))
    })
    return () => { u1(); u2() }
  }, [currentUser?.uid])

  // Load students when class changes (for individual targeting)
  useEffect(() => {
    if (!classKey) { setStudents([]); return }
    return onValue(ref(db, 'students'), snap => {
      const list = []
      snap.forEach(c => {
        const s = c.val()
        if (s.classKey === classKey && s.enrollmentStatus === 'Active') {
          list.push({ key: c.key, ...s })
        }
      })
      list.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))
      setStudents(list)
    })
  }, [classKey])

  const handleClassChange = (e) => {
    const cl = classes.find(c => c.key === e.target.value)
    setClassKey(e.target.value)
    setClassName(cl?.name || '')
    setTargetUid('')
  }

  const handleSend = async () => {
    setError('')
    if (!title.trim()) return setError('Please enter a notification title.')
    if (!body.trim())  return setError('Please enter a message.')
    if (targetType === 'class' && !classKey) return setError('Please select a class.')
    if (targetType === 'student' && !targetUid) return setError('Please select a student.')

    setSending(true)
    try {
      await push(ref(db, 'targetedNotifications'), {
        title:      title.trim(),
        body:       body.trim(),
        targetType,
        classKey:   targetType === 'class'   ? classKey   : null,
        className:  targetType === 'class'   ? className  : null,
        targetUid:  targetType === 'student' ? targetUid  : null,
        sentBy:     currentUser.uid,
        sentByName: userProfile?.displayName || currentUser.displayName || 'Teacher',
        sentAt:     new Date().toISOString(),
      })
      setSent(true)
      setTitle('')
      setBody('')
      setTimeout(() => setSent(false), 4000)
    } catch {
      setError('Failed to send notification. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">Send Notification</h2>
      <p className="text-sm text-slate-400 mb-5">Send a targeted push notification to a class or an individual student</p>

      {sent && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 mb-4 text-sm">
          ✓ Notification sent! Students will receive it on their devices.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-xl mb-8">

        {/* Target type */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Send to</label>
          <div className="grid grid-cols-2 gap-3">
            {[['class', '🏫', 'Entire Class', 'All active students in a class'], ['student', '👤', 'Individual Student', 'A specific student']].map(([val, icon, label, desc]) => (
              <button key={val} type="button" onClick={() => setTargetType(val)}
                className={`border-2 rounded-lg p-3 text-left transition-all ${targetType === val ? 'border-[#0D3B66] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-xs font-bold text-slate-700">{label}</div>
                <div className="text-xs text-slate-400">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Class picker */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {targetType === 'class' ? 'Class' : 'Class (to find student)'} <span className="text-red-500">*</span>
          </label>
          <select value={classKey} onChange={handleClassChange}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] bg-white">
            <option value="">— Select class —</option>
            {classes.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>

        {/* Individual student picker */}
        {targetType === 'student' && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Student <span className="text-red-500">*</span></label>
            <select value={targetUid} onChange={e => setTargetUid(e.target.value)}
              disabled={!classKey || students.length === 0}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] bg-white disabled:bg-slate-50">
              <option value="">— Select student —</option>
              {students.map(s => (
                <option key={s.key} value={s.linkedStudentUid || s.key}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </select>
            {classKey && students.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">No active students found in this class.</p>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Notification Title <span className="text-red-500">*</span></label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Reminder: Assignment due tomorrow"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Message <span className="text-red-500">*</span></label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Type your message here…" rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none" />
        </div>

        {/* Send */}
        <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
          className="w-full bg-[#0D3B66] text-white rounded-lg py-3 text-sm font-bold hover:bg-[#0a2f52] disabled:opacity-60 transition-colors">
          {sending ? 'Sending…' : `🔔 Send to ${targetType === 'class' ? (className || 'Class') : 'Student'}`}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <>
          <h3 className="font-semibold text-slate-700 mb-3 text-sm">Recently Sent</h3>
          <div className="space-y-2 max-w-xl">
            {history.map(n => (
              <div key={n.key} className="bg-white rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${n.targetType === 'class' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                      {n.targetType === 'class' ? `🏫 ${n.className || ''}` : '👤 Individual'}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      {n.sentAt ? new Date(n.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
