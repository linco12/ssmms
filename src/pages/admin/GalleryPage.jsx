import { useEffect, useRef, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, push, update, remove, set } from 'firebase/database'
import { uploadImage } from '../../utils/imageUpload'

const CATEGORIES = ['All', 'Academic', 'Sports', 'Events', 'Facilities']
const CAT_COLOR = {
  Academic: 'bg-blue-100 text-blue-700',
  Sports: 'bg-emerald-100 text-emerald-700',
  Events: 'bg-violet-100 text-violet-700',
  Facilities: 'bg-amber-100 text-amber-700',
}
const BLANK = { title: '', description: '', category: 'Events', date: new Date().toISOString().split('T')[0], imageUrl: '' }

export default function GalleryPage() {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadPct, setUploadPct] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    return onValue(ref(db, 'ssmms/gallery'), snap => {
      const list = []
      snap.forEach(c => { list.push({ key: c.key, ...c.val() }) })
      list.sort((a, b) => new Date(b.date) - new Date(a.date))
      setItems(list)
    })
  }, [])

  const filtered = filter === 'All' ? items : items.filter(i => i.category === filter)

  const openNew = () => {
    setForm({ ...BLANK, date: new Date().toISOString().split('T')[0] })
    setImageFile(null); setImagePreview(null); setModal('new')
  }
  const openEdit = item => {
    setForm(item); setImageFile(null); setImagePreview(item.imageUrl || null); setModal('edit')
  }

  const handleFileChange = e => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null); setImagePreview(null)
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
        imageUrl = await uploadImage(imageFile, 'gallery', pct => setUploadPct(pct))
        setUploadPct(null)
      }
      const data = { ...form, imageUrl, updatedAt: new Date().toISOString() }
      if (modal === 'new') {
        const r = push(ref(db, 'ssmms/gallery'))
        await set(r, { ...data, createdAt: new Date().toISOString() })
      } else {
        const { key, ...rest } = data
        await update(ref(db, `ssmms/gallery/${form.key}`), rest)
      }
      setModal(null)
    } finally {
      setSaving(false); setUploadPct(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#0D3B66]">School Gallery</h2>
          <p className="text-sm text-slate-400">{items.length} photos — visible to parents and students</p>
        </div>
        <button onClick={openNew}
          className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52]">
          + Add Photo
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === c ? 'bg-[#0D3B66] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#0D3B66]'}`}>
            {c} {c !== 'All' && items.filter(i => i.category === c).length > 0 && `(${items.filter(i => i.category === c).length})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(item => (
          <div key={item.key} className="group relative bg-white rounded-xl shadow overflow-hidden cursor-pointer"
            onClick={() => setPreview(item)}>
            <div className="aspect-video bg-slate-100 overflow-hidden">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => { e.target.style.display = 'none' }} />
                : <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl">🖼️</div>
              }
            </div>
            <div className="p-2.5">
              <p className="font-semibold text-xs text-slate-800 line-clamp-1">{item.title}</p>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CAT_COLOR[item.category] || 'bg-slate-100 text-slate-500'}`}>{item.category}</span>
                <span className="text-xs text-slate-400">{item.date}</span>
              </div>
            </div>
            <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
              <button onClick={e => { e.stopPropagation(); openEdit(item) }}
                className="bg-white text-xs text-[#0D3B66] px-2 py-1 rounded shadow font-medium hover:bg-slate-50">Edit</button>
              <button onClick={e => { e.stopPropagation(); if (confirm('Delete this photo?')) remove(ref(db, `ssmms/gallery/${item.key}`)) }}
                className="bg-white text-xs text-red-500 px-2 py-1 rounded shadow font-medium hover:bg-red-50">Del</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-4 py-12 text-center text-slate-400">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm">{filter === 'All' ? 'No photos yet. Add one above.' : `No photos in "${filter}" yet.`}</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
          <div className="max-w-3xl w-full bg-white rounded-xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
            {preview.imageUrl && (
              <img src={preview.imageUrl} alt={preview.title} className="w-full max-h-[60vh] object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${CAT_COLOR[preview.category] || ''}`}>{preview.category}</span>
                <span className="text-xs text-slate-400">{preview.date}</span>
              </div>
              <p className="font-bold text-[#0D3B66] text-lg">{preview.title}</p>
              {preview.description && <p className="text-sm text-slate-500 mt-1">{preview.description}</p>}
            </div>
            <button onClick={() => setPreview(null)}
              className="absolute top-3 right-3 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center text-lg hover:bg-black/70">×</button>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-[#0D3B66] mb-4">{modal === 'new' ? 'Add Photo' : 'Edit Photo'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Photo title…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short caption…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]">
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Photo</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm rounded-lg border border-slate-300 font-medium">
                    📷 Choose Photo
                  </button>
                  <span className="text-xs text-slate-400">Auto-compressed to &lt;400 KB</span>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                {uploadPct !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Uploading…</span>
                      <span className="font-semibold text-[#0D3B66]">{uploadPct}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-[#0D3B66] h-2 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
                    </div>
                  </div>
                )}

                {imagePreview && (
                  <div className="mt-2 relative inline-block">
                    <img src={imagePreview} alt="preview"
                      className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                    <button type="button" onClick={clearImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm flex items-center justify-center font-bold shadow hover:bg-red-600">×</button>
                    {imageFile && <p className="text-xs text-emerald-600 mt-1">New photo selected — will upload on Save</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setModal(null)} disabled={saving}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="px-5 py-2 text-sm bg-[#0D3B66] text-white rounded-lg hover:bg-[#0a2f52] disabled:opacity-60 font-semibold min-w-20">
                {saving ? (uploadPct !== null ? `${uploadPct}%` : 'Saving…') : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
