import { useEffect, useState } from 'react'
import { db } from '../firebase/config'
import { ref, onValue, remove } from 'firebase/database'
import { useAuth } from '../context/AuthContext'

const TYPE_STYLE = {
  announcement: { badge: 'bg-amber-100 text-amber-700',  icon: '📢' },
  event:        { badge: 'bg-violet-100 text-violet-700', icon: '📅' },
  news:         { badge: 'bg-blue-100 text-blue-700',     icon: '📰' },
  default:      { badge: 'bg-slate-100 text-slate-600',   icon: '🔔' },
}

export default function AnnouncementsSection() {
  const { userProfile } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [recentNews, setRecentNews]       = useState([])

  // Expiring announcements from BroadcastPage
  useEffect(() => {
    return onValue(ref(db, 'announcements'), snap => {
      const now = new Date().toISOString()
      const list = []
      const expiredKeys = []
      snap.forEach(c => {
        const a = c.val()
        if (a.expiresAt && a.expiresAt <= now) {
          expiredKeys.push(c.key)
        } else if (!a.targetRoles || !userProfile?.role || a.targetRoles.includes(userProfile.role)) {
          list.push({ key: c.key, source: 'broadcast', ...a })
        }
      })
      expiredKeys.forEach(k => remove(ref(db, `announcements/${k}`)))
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setAnnouncements(list)
    })
  }, [userProfile?.role])

  // Recent news/events from NewsPage (last 3 days)
  useEffect(() => {
    return onValue(ref(db, 'news'), snap => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 3)
      const cutoffStr = cutoff.toISOString().split('T')[0]

      const list = []
      snap.forEach(c => {
        const a = c.val()
        if (a.date && a.date >= cutoffStr) {
          list.push({ key: c.key, source: 'news', ...a })
        }
      })
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setRecentNews(list.slice(0, 5))
    })
  }, [])

  const all = [...announcements, ...recentNews]
  if (all.length === 0) return null

  return (
    <div className="mb-5 space-y-2">
      {announcements.map(a => (
        <Item key={`ann-${a.key}`} item={a} onDelete={k => remove(ref(db, `announcements/${k}`))} />
      ))}
      {recentNews.map(a => (
        <Item key={`news-${a.key}`} item={a} />
      ))}
    </div>
  )
}

function Item({ item, onDelete }) {
  const style = TYPE_STYLE[item.type] || TYPE_STYLE.default
  const exp = item.expiresAt ? new Date(item.expiresAt) : null
  const dateLabel = item.source === 'news'
    ? (item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
    : (item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-start gap-3 shadow-sm">
      <span className="text-lg mt-0.5 shrink-0">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${style.badge}`}>
            {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Notice'}
          </span>
          {dateLabel && <span className="text-xs text-slate-400">{dateLabel}</span>}
          {exp && <span className="text-xs text-slate-400">· expires {exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
        </div>
        <p className="font-semibold text-slate-800 text-sm leading-snug">{item.title}</p>
        {item.body && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{item.body}</p>}
      </div>
      {onDelete && (
        <button onClick={() => onDelete(item.key)} className="text-slate-300 hover:text-red-400 text-lg leading-none shrink-0 ml-1">×</button>
      )}
    </div>
  )
}
