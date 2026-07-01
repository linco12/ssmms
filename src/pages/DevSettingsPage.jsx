import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeatureFlags } from '../context/FeatureFlagsContext'
import { FLAG_META, DEFAULTS } from '../utils/featureFlags'

const GROUP_ORDER = [
  'Features',
  'Admin Navigation',
  'Teacher Navigation',
  'Parent Navigation',
  'Student Navigation',
]

const GROUP_ICONS = {
  'Features':            '⚙️',
  'Admin Navigation':    '🛡️',
  'Teacher Navigation':  '👩‍🏫',
  'Parent Navigation':   '👨‍👩‍👧',
  'Student Navigation':  '🎓',
}

export default function DevSettingsPage() {
  const { userProfile } = useAuth()
  const { flags, setFlag, resetAll, loaded } = useFeatureFlags()
  const navigate = useNavigate()

  if (!userProfile?.isDeveloper) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">Access denied. Developer account required.</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-[#0D3B66] hover:underline text-sm">Go back</button>
        </div>
      </div>
    )
  }

  const grouped = {}
  for (const [key, meta] of Object.entries(FLAG_META)) {
    if (!grouped[meta.group]) grouped[meta.group] = []
    grouped[meta.group].push({ key, ...meta })
  }

  const handleToggle = (key) => setFlag(key, !flags[key])

  const handleReset = async () => {
    if (window.confirm('Reset ALL feature flags to their default (all ON) values?')) {
      await resetAll()
    }
  }

  const offCount = Object.entries(flags).filter(([k, v]) => k in DEFAULTS && !v).length

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="text-[#0D3B66] text-sm hover:underline">← Back</button>
          <h1 className="text-2xl font-bold text-[#0D3B66]">Developer Settings</h1>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-xs text-amber-700">
          <strong>Firebase-backed:</strong> Flag changes save to Firebase instantly and affect all users in real time.
          The developer account always sees every feature regardless of these settings.
        </div>

        {offCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-orange-700 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span><strong>{offCount}</strong> feature{offCount > 1 ? 's are' : ' is'} currently hidden from users</span>
          </div>
        )}

        {!loaded && (
          <div className="text-center py-8 text-slate-400 text-sm">Loading flags from Firebase…</div>
        )}

        {loaded && GROUP_ORDER.map(group => {
          const items = grouped[group] || []
          if (!items.length) return null
          const groupOff = items.filter(i => !flags[i.key]).length
          return (
            <div key={group} className="bg-white rounded-xl shadow mb-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span>{GROUP_ICONS[group]}</span>
                  <span className="font-semibold text-slate-700 text-sm">{group}</span>
                  {groupOff > 0 && (
                    <span className="text-xs bg-orange-100 text-orange-600 rounded-full px-2 py-0.5 font-medium">
                      {groupOff} off
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => items.forEach(i => setFlag(i.key, true))}
                    className="text-xs text-emerald-600 hover:underline"
                  >All on</button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => items.forEach(i => setFlag(i.key, false))}
                    className="text-xs text-slate-400 hover:underline"
                  >All off</button>
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {items.map(({ key, label, desc }) => {
                  const on = flags[key] ?? true
                  return (
                    <div key={key} className="flex items-center justify-between px-5 py-3.5">
                      <div className="min-w-0 mr-4">
                        <p className={`font-medium text-sm ${on ? 'text-slate-800' : 'text-slate-400'}`}>{label}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{desc}</p>
                      </div>
                      <button
                        onClick={() => handleToggle(key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                          on ? 'bg-[#0D3B66]' : 'bg-slate-300'
                        }`}
                        title={on ? 'Click to disable' : 'Click to enable'}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {loaded && (
          <button
            onClick={handleReset}
            className="w-full border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 mt-2"
          >
            Reset All Flags to Defaults (everything ON)
          </button>
        )}
      </div>
    </div>
  )
}
