import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../firebase/config'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { ref, get, set } from 'firebase/database'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profileSnap = await get(ref(db, `users/${firebaseUser.uid}`))
        const profile = profileSnap.exists() ? profileSnap.val() : {}
        await set(ref(db, `users/${firebaseUser.uid}/lastLogin`), new Date().toISOString())
        setCurrentUser(firebaseUser)
        setUserProfile(profile)
      } else {
        setCurrentUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)

  const logout = () => signOut(auth)

  const value = { currentUser, userProfile, loading, login, logout }

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
