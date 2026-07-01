import { db } from '../firebase/config'
import { ref, push, serverTimestamp } from 'firebase/database'

export async function logAction(user, action, entity, details = {}) {
  try {
    const logsRef = ref(db, 'auditLogs')
    await push(logsRef, {
      uid: user?.uid || 'unknown',
      displayName: user?.displayName || user?.email || 'unknown',
      action,
      entity,
      details,
      timestamp: serverTimestamp(),
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}
