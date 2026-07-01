import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, set } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'

export default function AdminSettingsPage() {
  const { currentUser } = useAuth()
  const [storedKey, setStoredKey]         = useState(null) // null = not loaded yet
  const [currentInput, setCurrentInput]   = useState('')
  const [newKeyInput, setNewKeyInput]     = useState('')
  const [showKeys, setShowKeys]           = useState(false)
  const [saving, setSaving]               = useState(false)
  const [msg, setMsg]                     = useState({ type: '', text: '' })

  useEffect(() => {
    return onValue(ref(db, 'ssmms/adminSettings/deleteKey'), snap => {
      setStoredKey(snap.val() || '')
    })
  }, [])

  const flash = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const handleSaveKey = async () => {
    if (!newKeyInput.trim()) { flash('error', 'Please enter a new delete key.'); return }
    if (storedKey && !currentInput.trim()) { flash('error', 'Enter your current delete key first.'); return }
    if (storedKey && currentInput !== storedKey) { flash('error', 'Current delete key is incorrect.'); return }

    setSaving(true)
    try {
      await set(ref(db, 'ssmms/adminSettings/deleteKey'), newKeyInput.trim())
      await logAction(currentUser, 'UPDATE', 'adminSettings', { field: 'deleteKey' })
      flash('success', storedKey ? 'Delete key updated successfully.' : 'Delete key set. All deletions are now protected.')
      setCurrentInput('')
      setNewKeyInput('')
    } catch {
      flash('error', 'Failed to save. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveKey = async () => {
    if (!storedKey) return
    if (!currentInput.trim()) { flash('error', 'Enter the current delete key to remove protection.'); return }
    if (currentInput !== storedKey) { flash('error', 'Delete key is incorrect.'); return }
    setSaving(true)
    try {
      await set(ref(db, 'ssmms/adminSettings/deleteKey'), null)
      await logAction(currentUser, 'DELETE', 'adminSettings', { field: 'deleteKey' })
      flash('success', 'Delete key removed. Deletions are no longer protected.')
      setCurrentInput('')
      setNewKeyInput('')
    } catch {
      flash('error', 'Failed to remove key.')
    } finally {
      setSaving(false)
    }
  }

  const keyIsSet = Boolean(storedKey)

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0D3B66] mb-1">System Settings</h2>
      <p className="text-sm text-slate-400 mb-8">Configure security and system-wide settings for SSMMS.</p>

      {/* ── Delete Key ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-xl mb-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🔐</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Delete Key</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              A secret key that must be entered before any record can be deleted from the system.
              This prevents accidental or unauthorised deletions.
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold mb-5 ${keyIsSet ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
          <span>{keyIsSet ? '● Delete key is active — all deletions are protected' : '⚠ No delete key set — deletions are unprotected'}</span>
        </div>

        {storedKey === null && (
          <p className="text-sm text-slate-400">Loading…</p>
        )}

        {storedKey !== null && (
          <div className="space-y-4">
            {keyIsSet && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Current Delete Key *</label>
                <input
                  type={showKeys ? 'text' : 'password'}
                  value={currentInput}
                  onChange={e => setCurrentInput(e.target.value)}
                  placeholder="Enter your current delete key"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {keyIsSet ? 'New Delete Key *' : 'Set Delete Key *'}
              </label>
              <div className="relative">
                <input
                  type={showKeys ? 'text' : 'password'}
                  value={newKeyInput}
                  onChange={e => setNewKeyInput(e.target.value)}
                  placeholder="e.g. ADMIN2026 or a passphrase"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
                />
                <button type="button" onClick={() => setShowKeys(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium">
                  {showKeys ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Choose something memorable but not guessable. It will be required each time a deletion is attempted.</p>
            </div>

            {msg.text && (
              <div className={`rounded-lg px-3 py-2.5 text-sm ${msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                {msg.text}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleSaveKey} disabled={saving || !newKeyInput.trim()}
                className="flex-1 bg-[#0D3B66] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60">
                {saving ? 'Saving…' : keyIsSet ? 'Update Delete Key' : 'Set Delete Key'}
              </button>
              {keyIsSet && (
                <button onClick={handleRemoveKey} disabled={saving}
                  className="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-60">
                  Remove Key
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Info box ───────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-xl">
        <h4 className="text-sm font-bold text-blue-800 mb-1">How the delete key works</h4>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Whenever anyone attempts to delete a student, user, fee record, or any other data, this key must be entered first.</li>
          <li>Only the admin who knows the key can authorise deletions.</li>
          <li>Failed attempts are shown immediately — the deletion does not proceed.</li>
          <li>You can update or remove the key at any time from this page.</li>
        </ul>
      </div>
    </div>
  )
}
