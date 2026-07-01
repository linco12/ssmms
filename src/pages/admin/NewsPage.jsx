import { useEffect, useRef, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, update, remove, set } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { uploadImage } from '../../utils/imageUpload'

const TYPES = ['announcement', 'event', 'news']
const TYPE_STYLE = {
  announcement: 'bg-amber-100 text-amber-800',
  event: 'bg-violet-100 text-violet-800',
  news: 'bg-blue-100 text-blue-700',
}
const BLANK = {
  title: '', body: '', type: 'announcement',
  date: new Date().toISOString().split('T')[0],
  imageUrl: '', pinned: false,
}

export default function NewsPage() {
  const { currentUser } = useAuth()
  const [articles, setArticles] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [uploadPct, setUploadPct] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileRef = useRef()

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

  const openNew = () => {
    setForm({ ...BLANK, date: new Date().toISOString().split('T')[0] })
    setImageFile(null); setImagePreview(null); setModal('new')
  }
  const openEdit = a => {
    setForm(a); setImageFile(null); setImagePreview(a.imageUrl || null); setModal('edit')
  }

  const handleFileChange = e => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setForm(f => ({ ...f, imageUrl: '' }))
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      let imageUrl = form.imageUrl || ''
      if (imageFile) {
        setUploadPct(0)
        imageUrl = await uploadImage(imageFile, 'news', pct => setUploadPct(pct))
        setUploadPct(null)
      }
      const data = { ...form, imageUrl, updatedAt: new Date().toISOString(), createdBy: currentUser.uid }
      if (modal === 'new') {
        const r = push(ref(db, 'ssmms/news'))
        await set(r, { ...data, createdAt: new Date().toISOString() })
      } else {
        const { key, ...rest } = data
        await update(ref(db, `ssmms/news/${form.key}`), rest)
      }
      setModal(null)
    } finally {
      setSaving(false); setUploadPct(null)
    }
  }

  const handleDelete = async (key, title) => {
    if (!confirm(`Delete "${title}"?`)) return
    await remove(ref(db, `ssmms/news/${key}`))
  }

  const togglePin = async a => {
    await update(ref(db, `ssmms/news/${a.key}`), { pinned: !a.pinned })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#0D3B66]">News & Announcements</h2>
          <p className="text-sm text-slate-400">{articles.length} articles — visible to parents and students</p>
        </div>
        <button onClick={openNew} className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52]">
          + New Article
        </button>
      </div>

      <div className="space-y-3">
        {articles.map(a => (
          <div key={a.key} className={`bg-white rounded-xl shadow flex gap-4 overflow-hidden ${a.pinned ? 'ring-2 ring-[#0D3B66]' : ''}`}>
            {a.imageUrl && (
              <img src={a.imageUrl} alt={a.title} className="w-32 h-24 object-cover shrink-0"
                onError={e => { e.target.style.display = 'none' }} />
            )}
            <div className="flex-1 py-3 pr-4 min-w-0 pl-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {a.pinned && <span className="text-xs bg-[#0D3B66] text-white px-2 py-0.5 rounded-full font-semibold">📌 Pinned</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${TYPE_STYLE[a.type]}`}>{a.type}</span>
                <span className="text-xs text-slate-400">{a.date}</span>
              </div>
              <p className="font-semibold text-[#0D3B66] text-sm leading-tight line-clamp-1">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.body}</p>
            </div>
            <div className="flex flex-col gap-1 justify-center pr-3 shrink-0">
              <button onClick={() => togglePin(a)}
                className={`text-xs px-2 py-1 rounded ${a.pinned ? 'text-[#0D3B66] font-semibold' : 'text-slate-400'} hover:bg-slate-100`}>Pin</button>
              <button onClick={() => openEdit(a)} className="text-xs text-[#0D3B66] hover:underline">Edit</button>
              <button onClick={() => handleDelete(a.key, a.title)} className="text-xs text-red-500 hover:underline">Del</button>
            </div>
          </div>
        ))}
        {articles.length === 0 && <p className="text-slate-400 text-sm">No articles yet. Create one above.</p>}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-[#0D3B66] mb-4">{modal === 'new' ? 'New Article' : 'Edit Article'}</h3>
            <div className="grid grid-cols-2 gap-3">

              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Article title…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Body</label>
                <textarea rows={5} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write the article content…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none" />
              </div>

              {/* Image upload section */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-2">Cover Image</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm rounded-lg border border-slate-300 font-medium transition-colors">
                    📷 Choose Image
                  </button>
                  <span className="text-xs text-slate-400">Auto-compressed to under 400 KB before upload</span>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                {uploadPct !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Uploading image…</span>
                      <span className="font-semibold text-[#0D3B66]">{uploadPct}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-[#0D3B66] h-2 rounded-full transition-all duration-150" style={{ width: `${uploadPct}%` }} />
                    </div>
                  </div>
                )}

                {imagePreview && (
                  <div className="mt-3 relative inline-block">
                    <img src={imagePreview} alt="preview"
                      className="h-36 w-auto rounded-xl object-cover border border-slate-200 shadow-sm" />
                    <button type="button" onClick={clearImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm flex items-center justify-center font-bold shadow-md hover:bg-red-600">
                      ×
                    </button>
                    {!imageFile && <p className="text-xs text-slate-400 mt-1">Current image — choose a new one to replace</p>}
                    {imageFile && <p className="text-xs text-emerald-600 mt-1">New image selected — will upload when you Publish</p>}
                  </div>
                )}
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="pinCheck" checked={!!form.pinned}
                  onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="accent-[#0D3B66]" />
                <label htmlFor="pinCheck" className="text-sm text-slate-700 select-none">Pin to top (shows first to all users)</label>
              </div>
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setModal(null)} disabled={saving}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="px-5 py-2 text-sm bg-[#0D3B66] text-white rounded-lg hover:bg-[#0a2f52] disabled:opacity-60 min-w-24 font-semibold">
                {saving ? (uploadPct !== null ? `Uploading ${uploadPct}%` : 'Saving…') : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
