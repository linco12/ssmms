import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, remove } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { broadcastToParents } from '../../services/notificationService'
import FeatureGate from '../../components/FeatureGate'

export default function BroadcastPage() {
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('announcements') // 'announcements' | 'targeted'
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expiresDate, setExpiresDate] = useState('')
  const [expiresTime, setExpiresTime] = useState('23:59')
  const [targetRoles, setTargetRoles] = useState(['parent', 'student', 'teacher'])
  const [announcements, setAnnouncements] = useState([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // Targeted notification state
  const [tTitle, setTTitle]       = useState('')
  const [tBody, setTBody]         = useState('')
  const [tType, setTType]         = useState('class') // 'class' | 'student'
  const [tClassKey, setTClassKey] = useState('')
  const [tClassName, setTClassName] = useState('')
  const [tTargetUid, setTTargetUid] = useState('')
  const [classes, setClasses]     = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [classStudents, setClassStudents] = useState([])
  const [tSending, setTSending]   = useState(false)
  const [tSent, setTSent]         = useState(false)
  const [tError, setTError]       = useState('')

  useEffect(() => {
    const u1 = onValue(ref(db, 'announcements'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setAnnouncements(list)
    })
    const u2 = onValue(ref(db, 'classes'), snap => {
      const list = []
      snap.forEach(c => list.push({ key: c.key, ...c.val() }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setClasses(list)
    })
    const u3 = onValue(ref(db, 'students'), snap => {
      const list = []
      snap.forEach(c => list.push({ key: c.key, ...c.val() }))
      setAllStudents(list)
    })
    return () => { u1(); u2(); u3() }
  }, [])

  const now = new Date().toISOString()
  const active = announcements.filter(a => !a.expiresAt || a.expiresAt > now)
  const expired = announcements.filter(a => a.expiresAt && a.expiresAt <= now)

  const toggleRole = (role) => {
    setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const expiresAt = expiresDate
        ? new Date(`${expiresDate}T${expiresTime || '23:59'}:00`).toISOString()
        : null

      // Save to announcements node
      await push(ref(db, 'announcements'), {
        title: title.trim(),
        body: body.trim(),
        expiresAt,
        targetRoles,
        createdBy: currentUser?.uid,
        createdAt: new Date().toISOString(),
      })

      // Also send notification to parents
      if (targetRoles.includes('parent')) {
        await broadcastToParents(title.trim(), body.trim())
      }

      setSent(true)
      setTitle(''); setBody(''); setExpiresDate(''); setExpiresTime('23:59')
      setTimeout(() => setSent(false), 4000)
    } finally {
      setSending(false)
    }
  }

  const deleteAnnouncement = async (key) => {
    if (!confirm('Delete this announcement?')) return
    await remove(ref(db, `announcements/${key}`))
  }

  // Targeted notification helpers
  const handleTClassChange = (e) => {
    const cl = classes.find(c => c.key === e.target.value)
    setTClassKey(e.target.value)
    setTClassName(cl?.name || '')
    setTTargetUid('')
    const filtered = allStudents.filter(s => s.classKey === e.target.value && s.enrollmentStatus === 'Active')
    filtered.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))
    setClassStudents(filtered)
  }

  const handleTargetedSend = async () => {
    setTError('')
    if (!tTitle.trim()) return setTError('Please enter a title.')
    if (!tBody.trim())  return setTError('Please enter a message.')
    if (tType === 'class'   && !tClassKey)   return setTError('Please select a class.')
    if (tType === 'student' && !tTargetUid)  return setTError('Please select a student.')
    setTSending(true)
    try {
      await push(ref(db, 'targetedNotifications'), {
        title:     tTitle.trim(),
        body:      tBody.trim(),
        targetType: tType,
        classKey:  tType === 'class'   ? tClassKey  : null,
        className: tType === 'class'   ? tClassName : null,
        targetUid: tType === 'student' ? tTargetUid : null,
        sentBy:    currentUser.uid,
        sentAt:    new Date().toISOString(),
      })
      setTSent(true)
      setTTitle(''); setTBody(''); setTTargetUid('')
      setTimeout(() => setTSent(false), 4000)
    } catch {
      setTError('Failed to send. Please try again.')
    } finally {
      setTSending(false)
    }
  }

  const ROLES = ['admin', 'finance', 'teacher', 'parent', 'student']

  return (
    <FeatureGate flag="parentBroadcast">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-1">Broadcast &amp; Notifications</h2>
        <p className="text-sm text-slate-400 mb-4">Send announcements to all users or target a specific class or individual.</p>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-6 w-fit">
          {[['announcements', '📢 Announcements'], ['targeted', '🎯 Targeted Notify']].map(([val, label]) => (
            <button key={val} onClick={() => setActiveTab(val)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all
                ${activeTab === val ? 'bg-white text-[#0D3B66] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Targeted notification tab ───────────────────────── */}
        {activeTab === 'targeted' && (
          <div className="max-w-xl">
            {tSent && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 mb-4 text-sm">
                ✓ Notification sent! Recipients will receive it on their devices.
              </div>
            )}
            {tError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{tError}</div>
            )}
            <div className="bg-white rounded-xl shadow p-6 space-y-4">
              <h3 className="font-semibold text-slate-700">Targeted Notification</h3>

              {/* Target type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Send to</label>
                <div className="grid grid-cols-2 gap-3">
                  {[['class','🏫','Entire Class','All active students in a class'],['student','👤','Individual Student','A specific student']].map(([val, icon, label, desc]) => (
                    <button key={val} type="button" onClick={() => setTType(val)}
                      className={`border-2 rounded-lg p-3 text-left transition-all ${tType === val ? 'border-[#0D3B66] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="text-xl mb-1">{icon}</div>
                      <div className="text-xs font-bold text-slate-700">{label}</div>
                      <div className="text-xs text-slate-400">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Class picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {tType === 'class' ? 'Target Class' : 'Class (to find student)'}
                </label>
                <select value={tClassKey} onChange={handleTClassChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] bg-white">
                  <option value="">— Select class —</option>
                  {classes.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </div>

              {/* Individual student picker */}
              {tType === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Student</label>
                  <select value={tTargetUid} onChange={e => setTTargetUid(e.target.value)}
                    disabled={!tClassKey}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] bg-white disabled:bg-slate-50">
                    <option value="">— Select student —</option>
                    {classStudents.map(s => (
                      <option key={s.key} value={s.linkedStudentUid || s.key}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                  {!tClassKey && <p className="text-xs text-slate-400 mt-1">Select a class first</p>}
                </div>
              )}

              {/* Title + message */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input value={tTitle} onChange={e => setTTitle(e.target.value)}
                  placeholder="e.g. Important Notice for Form 3A"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea value={tBody} onChange={e => setTBody(e.target.value)}
                  rows={4} placeholder="Type your message…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none" />
              </div>

              <button onClick={handleTargetedSend}
                disabled={tSending || !tTitle.trim() || !tBody.trim()}
                className="w-full bg-[#0D3B66] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60 transition-colors">
                {tSending ? 'Sending…' : `🔔 Send to ${tType === 'class' ? (tClassName || 'Class') : 'Student'}`}
              </button>
            </div>
          </div>
        )}

        {/* ── Announcements tab ───────────────────────────────── */}
        {activeTab === 'announcements' && (
        <div>
        {sent && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 mb-4 text-sm">
            Announcement sent and saved successfully.
          </div>
        )}

        {/* Compose */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4 mb-8 max-w-2xl">
          <h3 className="font-semibold text-slate-700">New Announcement</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. End of Term Reminder"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Type your announcement here…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expires on (date)</label>
              <input type="date" value={expiresDate} onChange={e => setExpiresDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              <p className="text-xs text-slate-400 mt-1">Leave blank to keep until manually deleted</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expires at (time)</label>
              <input type="time" value={expiresTime} onChange={e => setExpiresTime(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Visible to</label>
            <div className="flex gap-2 flex-wrap">
              {ROLES.map(role => (
                <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={targetRoles.includes(role)} onChange={() => toggleRole(role)} className="accent-[#0D3B66]" />
                  <span className="text-sm text-slate-600 capitalize">{role}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim() || targetRoles.length === 0}
            className="w-full bg-[#0D3B66] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60 transition-colors">
            {sending ? 'Sending…' : 'Send Announcement'}
          </button>
        </div>

        {/* Active announcements */}
        <h3 className="font-semibold text-slate-700 mb-3">Active Announcements ({active.length})</h3>
        {active.length === 0 && <p className="text-slate-400 text-sm mb-6">No active announcements.</p>}
        <div className="space-y-3 mb-6">
          {active.map(a => (
            <AnnouncementCard key={a.key} a={a} onDelete={deleteAnnouncement} />
          ))}
        </div>

        {/* Expired */}
        {expired.length > 0 && (
          <>
            <h3 className="font-semibold text-slate-400 mb-3 text-sm">Expired ({expired.length})</h3>
            <div className="space-y-2 opacity-50">
              {expired.map(a => (
                <AnnouncementCard key={a.key} a={a} onDelete={deleteAnnouncement} expired />
              ))}
            </div>
          </>
        )}
        </div>
        )}
      </div>
    </FeatureGate>
  )
}

function AnnouncementCard({ a, onDelete, expired }) {
  const exp = a.expiresAt ? new Date(a.expiresAt) : null
  return (
    <div className={`bg-white rounded-xl shadow p-4 flex items-start gap-3 ${expired ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-slate-800 text-sm">{a.title}</p>
          {expired && <span className="text-xs text-red-500 font-semibold">Expired</span>}
        </div>
        <p className="text-sm text-slate-600 mb-1">{a.body}</p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <span>Created: {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB') : '?'}</span>
          {exp && <span>Expires: {exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {exp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
          {a.targetRoles && <span>Roles: {a.targetRoles.join(', ')}</span>}
        </div>
      </div>
      <button onClick={() => onDelete(a.key)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
    </div>
  )
}
