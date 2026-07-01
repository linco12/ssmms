import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, update } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import FeatureGate from '../../components/FeatureGate'
import AnnouncementsSection from '../../components/AnnouncementsSection'

export default function ParentNotificationsPage() {
  const { currentUser } = useAuth()
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!currentUser) return
    return onValue(ref(db, `notifications/${currentUser.uid}`), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setNotifications(list)
    })
  }, [currentUser])

  const markRead = async (key) => {
    await update(ref(db, `notifications/${currentUser.uid}/${key}`), { read: true })
  }

  const TYPE_STYLE = {
    payment: 'bg-emerald-100 text-emerald-700',
    results: 'bg-blue-100 text-blue-700',
    announcement: 'bg-violet-100 text-violet-700',
    info: 'bg-slate-100 text-slate-600',
  }

  return (
    <FeatureGate flag="notificationsEngine">
      <div>
        <h2 className="text-xl font-bold text-[#0D3B66] mb-4">Notifications</h2>
        <AnnouncementsSection />
        {notifications.length === 0 && (
          <div className="text-center py-10 text-slate-400">No notifications yet.</div>
        )}
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.key}
              onClick={() => !n.read && markRead(n.key)}
              className={`bg-white rounded-xl shadow p-4 cursor-pointer transition-opacity ${n.read ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[n.type] || TYPE_STYLE.info}`}>
                      {n.type || 'info'}
                    </span>
                    {!n.read && <span className="w-2 h-2 bg-[#0D3B66] rounded-full"></span>}
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                  <p className="text-slate-600 text-sm mt-0.5">{n.body}</p>
                </div>
                <p className="text-xs text-slate-400 shrink-0">
                  {n.timestamp ? new Date(n.timestamp).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FeatureGate>
  )
}
