import { useEffect, useState } from 'react'
import { db } from '../firebase/config'
import { ref, onValue } from 'firebase/database'

const CATEGORIES = ['All', 'Academic', 'Sports', 'Events', 'Facilities']
const CAT_COLOR = { Academic: 'bg-blue-100 text-blue-700', Sports: 'bg-emerald-100 text-emerald-700', Events: 'bg-violet-100 text-violet-700', Facilities: 'bg-amber-100 text-amber-700' }

export default function GalleryViewer() {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('All')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    return onValue(ref(db, 'ssmms/gallery'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => new Date(b.date) - new Date(a.date))
      setItems(list)
    })
  }, [])

  const filtered = filter === 'All' ? items : items.filter(i => i.category === filter)

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-4">School Gallery</h2>

      <div className="flex gap-2 mb-5 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === c ? 'bg-[#0D3B66] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#0D3B66]'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map(item => (
          <div key={item.key} className="group bg-white rounded-xl shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setPreview(item)}>
            <div className="aspect-video bg-slate-100 overflow-hidden">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={e => { e.target.style.display='none' }} />
                : <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl">🖼️</div>
              }
            </div>
            <div className="p-3">
              <p className="font-semibold text-sm text-slate-800 line-clamp-1">{item.title}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${CAT_COLOR[item.category] || 'bg-slate-100 text-slate-500'}`}>{item.category}</span>
                <span className="text-xs text-slate-400">{item.date}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-slate-400 text-sm col-span-3">No photos in this category.</p>}
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
          <div className="max-w-2xl w-full bg-white rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {preview.imageUrl && <img src={preview.imageUrl} alt={preview.title} className="w-full max-h-[55vh] object-cover" onError={() => {}} />}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${CAT_COLOR[preview.category] || ''}`}>{preview.category}</span>
                <span className="text-xs text-slate-400">{preview.date}</span>
              </div>
              <p className="font-bold text-[#0D3B66] text-lg">{preview.title}</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">{preview.description}</p>
            </div>
            <button onClick={() => setPreview(null)} className="fixed top-6 right-6 text-white bg-black/60 hover:bg-black/80 rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold">×</button>
          </div>
        </div>
      )}
    </div>
  )
}
