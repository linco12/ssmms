import { db } from './config'
import { ref, onValue, goOffline, goOnline } from 'firebase/database'

// Firebase Realtime Database enables offline persistence by default in the client SDK.
// It caches data locally and syncs when reconnected.
// No explicit enablePersistence() call needed for RTDB (unlike Firestore).

export function setupOfflineMonitor(onOnline, onOffline) {
  const connectedRef = ref(db, '.info/connected')
  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onOnline?.()
    } else {
      onOffline?.()
    }
  })
  return unsub
}
