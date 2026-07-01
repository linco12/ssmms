import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { db } from '../firebase/config'
import { get, ref } from 'firebase/database'

const DeleteKeyContext = createContext({ confirmDelete: () => {} })

export function DeleteKeyProvider({ children }) {
  const [visible, setVisible]   = useState(false)
  const [input, setInput]       = useState('')
  const [error, setError]       = useState('')
  const [checking, setChecking] = useState(false)
  const cbRef = useRef(null)

  const confirmDelete = useCallback((callback) => {
    cbRef.current = callback
    setInput('')
    setError('')
    setVisible(true)
  }, [])

  const close = () => setVisible(false)

  const handleConfirm = async () => {
    if (!input.trim()) { setError('Enter the delete key.'); return }
    setChecking(true)
    setError('')
    try {
      const snap = await get(ref(db, 'adminSettings/deleteKey'))
      const stored = snap.val()
      if (!stored) {
        // No key configured — warn admin but allow
        close()
        cbRef.current?.()
        return
      }
      if (input.trim() === stored) {
        close()
        cbRef.current?.()
      } else {
        setError('Incorrect delete key. Access denied.')
      }
    } catch {
      setError('Could not verify key. Check your connection.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <DeleteKeyContext.Provider value={{ confirmDelete }}>
      {children}
      {visible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🔐</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Delete Confirmation</h3>
              <p className="text-sm text-slate-500 mt-1">This action cannot be undone. Enter the admin delete key to proceed.</p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">{error}</div>
            )}
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Admin delete key"
              autoFocus
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button onClick={close}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={checking || !input.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
                {checking ? 'Verifying…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DeleteKeyContext.Provider>
  )
}

export const useDeleteKey = () => useContext(DeleteKeyContext)
