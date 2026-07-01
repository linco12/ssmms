import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, update } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import AnnouncementsSection from '../../components/AnnouncementsSection'

export default function StudentNotificationsPage() {
  const { currentUser } = useAuth()
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!currentUser) return
    return onValue(ref(db, `notifications/${currentUser.uid}`), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setNotifications(list)
    })
  }, [currentUser])

  const markRead = async (key) => {
    await update(ref(db, `notifications/${currentUser.uid}/${key}`), { read: true })
  }

  const unread = notifications.filter((n) => !n.read).length

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-4">
        Notifications {unread > 0 && <span className="ml-2 text-sm bg-red-100 text-red-600 rounded-full px-2 py-0.5">{unread} new</span>}
      </h2>

      <AnnouncementsSection />
      {notifications.length === 0 && <p className="text-slate-400 text-sm">No notifications yet.</p>}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div key={n.key}
            onClick={() => !n.read && markRead(n.key)}
            className={`rounded-xl border p-4 cursor-pointer transition-colors ${n.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex justify-between items-start">
              <p className={`font-semibold text-sm ${n.read ? 'text-slate-700' : 'text-[#0D3B66]'}`}>{n.title}</p>
              <span className="text-xs text-slate-400 shrink-0 ml-3">{new Date(n.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{n.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
