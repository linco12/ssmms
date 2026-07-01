import { createContext, useContext, useEffect, useState } from 'react'
import { db } from '../firebase/config'
import { ref, onValue, set, remove } from 'firebase/database'
import { useAuth } from './AuthContext'
import { DEFAULTS } from '../utils/featureFlags'

const FeatureFlagsContext = createContext({
  flags: DEFAULTS,
  userPrivileges: {},
  isEnabled: () => true,
  setFlag: async () => {},
  resetAll: async () => {},
  setUserPrivilege: async () => {},
  removeUserPrivilege: async () => {},
})

export function FeatureFlagsProvider({ children }) {
  const { userProfile, currentUser } = useAuth()
  const [flags, setFlags]                 = useState(DEFAULTS)
  const [userPrivileges, setUserPrivileges] = useState({})
  const [loaded, setLoaded]               = useState(false)

  // Global flags
  useEffect(() => {
    return onValue(ref(db, 'ssmms/featureFlags'), snap => {
      setFlags({ ...DEFAULTS, ...( snap.val() || {}) })
      setLoaded(true)
    })
  }, [])

  // Per-user privilege overrides for current user
  useEffect(() => {
    if (!currentUser?.uid) return
    return onValue(ref(db, `ssmms/userPrivileges/${currentUser.uid}`), snap => {
      setUserPrivileges(snap.val() || {})
    })
  }, [currentUser?.uid])

  // Developer always sees everything; per-user overrides beat global flags
  const isEnabled = (flagKey) => {
    if (!flagKey) return true
    if (userProfile?.isDeveloper) return true
    if (flagKey in userPrivileges) return Boolean(userPrivileges[flagKey])
    return flags[flagKey] ?? true
  }

  const setFlag            = (key, value)        => set(ref(db, `ssmms/featureFlags/${key}`), Boolean(value))
  const resetAll           = ()                   => set(ref(db, 'ssmms/featureFlags'), DEFAULTS)
  const setUserPrivilege   = (uid, key, value)   => set(ref(db, `ssmms/userPrivileges/${uid}/${key}`), Boolean(value))
  const removeUserPrivilege = (uid, key)          => remove(ref(db, `ssmms/userPrivileges/${uid}/${key}`))

  return (
    <FeatureFlagsContext.Provider value={{ flags, userPrivileges, isEnabled, setFlag, resetAll, loaded, setUserPrivilege, removeUserPrivilege }}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export const useFeatureFlags = () => useContext(FeatureFlagsContext)
