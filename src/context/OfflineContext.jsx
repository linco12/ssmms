import { createContext, useContext, useEffect, useState } from 'react'
import { setupOfflineMonitor } from '../firebase/offlinePersistence'
import { getFlag } from '../utils/featureFlags'

const OfflineContext = createContext({ isOnline: true })

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true)
  const [showSynced, setShowSynced] = useState(false)

  useEffect(() => {
    if (!getFlag('offlineMode')) return
    const unsub = setupOfflineMonitor(
      () => {
        setIsOnline(true)
        setShowSynced(true)
        setTimeout(() => setShowSynced(false), 3000)
      },
      () => setIsOnline(false)
    )
    return unsub
  }, [])

  return (
    <OfflineContext.Provider value={{ isOnline, showSynced }}>
      {children}
      {getFlag('offlineMode') && !isOnline && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-500 text-white text-center text-sm py-2 z-50 font-medium">
          Offline — changes will sync automatically when reconnected
        </div>
      )}
      {getFlag('offlineMode') && showSynced && (
        <div className="fixed bottom-0 left-0 right-0 bg-emerald-600 text-white text-center text-sm py-2 z-50 font-medium">
          Synced — all changes have been saved
        </div>
      )}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  return useContext(OfflineContext)
}
