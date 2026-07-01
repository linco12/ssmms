import { useEffect, useState } from 'react'
import { db } from '../firebase/config'
import { ref, onValue } from 'firebase/database'

const TYPE_STYLE = { announcement: 'bg-amber-100 text-amber-800 border-amber-200', event: 'bg-violet-100 text-violet-800 border-violet-200', news: 'bg-blue-100 text-blue-700 border-blue-200' }
const FILTERS = ['All', 'announcement', 'event', 'news']

export default function NewsViewer() {
  const [articles, setArticles] = useState([])
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    return onValue(ref(db, 'ssmms/news'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.date) - new Date(a.date)
      })
      setArticles(list)
    })
  }, [])

  const filtered = filter === 'All' ? articles : articles.filter(a => a.type === filter)

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-4">News & Announcements</h2>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-[#0D3B66] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#0D3B66]'}`}>
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="text-slate-400 text-sm">No articles found.</p>}

      <div className="space-y-4">
        {filtered.map(a => (
          <div key={a.key} className={`bg-white rounded-xl shadow overflow-hidden ${a.pinned ? 'ring-2 ring-[#0D3B66]' : ''}`}>
            {a.imageUrl && (
              <img src={a.imageUrl} alt={a.title} className="w-full h-48 object-cover"
                onError={e => { e.target.style.display = 'none' }} />
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {a.pinned && <span className="text-xs bg-[#0D3B66] text-white px-2 py-0.5 rounded-full font-semibold">📌 Pinned</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize border ${TYPE_STYLE[a.type] || ''}`}>{a.type}</span>
                <span className="text-xs text-slate-400 ml-auto">{new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <h3 className="font-bold text-[#0D3B66] text-base mb-1">{a.title}</h3>
              <p className={`text-sm text-slate-600 leading-relaxed ${expanded === a.key ? '' : 'line-clamp-3'}`}>{a.body}</p>
              {a.body?.length > 200 && (
                <button onClick={() => setExpanded(expanded === a.key ? null : a.key)}
                  className="text-xs text-[#0D3B66] font-semibold mt-1 hover:underline">
                  {expanded === a.key ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
