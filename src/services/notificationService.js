import { db, messaging } from '../firebase/config'
import { ref, push, serverTimestamp, get } from 'firebase/database'
import { getToken, onMessage } from 'firebase/messaging'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// --- In-app notifications (Firebase RTDB) ---

export async function createNotification(uid, { title, body, type = 'info', link = '' }) {
  await push(ref(db, `notifications/${uid}`), {
    title,
    body,
    type,
    link,
    read: false,
    timestamp: serverTimestamp(),
  })
}

export async function broadcastToParents(title, body) {
  const usersSnap = await get(ref(db, 'users'))
  if (!usersSnap.exists()) return
  const promises = []
  usersSnap.forEach((child) => {
    const user = child.val()
    if (user.role === 'parent') {
      promises.push(createNotification(child.key, { title, body, type: 'announcement' }))
    }
  })
  await Promise.all(promises)
}

// --- Firebase Cloud Messaging (browser push) ---

export async function requestFCMPermission() {
  if (!messaging) return null
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    return token
  } catch {
    return null
  }
}

export function onForegroundMessage(callback) {
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
