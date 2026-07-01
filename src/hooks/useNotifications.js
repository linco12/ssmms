import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { db } from '../firebase/config'
import { ref, set, onValue, onChildAdded } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { scheduleTimetableNotifications } from '../services/timetableNotifications'

function tokenKey(raw) {
  return raw.replace(/[.#$[\]/]/g, '-').substring(0, 60)
}

async function ensureChannels() {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  await PushNotifications.createChannel({
    id: 'ssmms_default',
    name: 'School Notifications',
    description: 'Announcements, news and events from the school',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#0D3B66',
    sound: 'default',
  })
}

// Show an immediate local notification (fires 500ms from now)
async function showLocalNotif(title, body, type) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.createChannel({
      id: 'ssmms_default',
      name: 'School Notifications',
      importance: 5,
      vibration: true,
      lights: true,
      lightColor: '#0D3B66',
      sound: 'default',
    })
    await LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Date.now() % 2_000_000_000),
        channelId: 'ssmms_default',
        title,
        body: body || '',
        schedule: { at: new Date(Date.now() + 500) },
        sound: 'default',
        smallIcon: 'ic_stat_notification',
        iconColor: '#0D3B66',
        extra: { type },
      }],
    })
  } catch (e) {
    console.error('showLocalNotif failed', e)
  }
}

export function useNotifications() {
  const { currentUser, userProfile } = useAuth()
  const timetableUnsub = useRef(null)

  // ── Native Android: FCM push registration ────────────────────────────────
  useEffect(() => {
    if (!currentUser || !Capacitor.isNativePlatform()) return
    let listeners = []

    ;(async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        await ensureChannels()

        const perm = await PushNotifications.requestPermissions()
        if (perm.receive !== 'granted') return

        await PushNotifications.register()

        listeners.push(await PushNotifications.addListener('registration', async ({ value }) => {
          await set(ref(db, `ssmms/users/${currentUser.uid}/fcmTokens/${tokenKey(value)}`), value)
        }))

        listeners.push(await PushNotifications.addListener('registrationError', err => {
          console.error('FCM registration error', err)
        }))

        listeners.push(await PushNotifications.addListener('pushNotificationActionPerformed', action => {
          const data = action.notification?.data || {}
          const role = userProfile?.role || 'student'
          const routes = {
            announcement: `/${role}/notifications`,
            news:         `/${role}/news`,
            event:        `/${role}/calendar`,
            timetable:    `/${role}/timetable`,
          }
          const dest = routes[data.type]
          if (dest) window.location.hash = `#${dest}`
        }))
      } catch (err) {
        console.error('Push notification init failed:', err)
      }
    })()

    return () => { listeners.forEach(l => l?.remove?.()) }
  }, [currentUser])

  // ── Realtime Firebase → local notifications ───────────────────────────────
  // When admin posts a new announcement or news article, Firebase pushes it to
  // the device's open WebSocket. We immediately show a local notification.
  // Works while app is open or running in background (not force-killed).
  useEffect(() => {
    if (!currentUser || !userProfile?.role || !Capacitor.isNativePlatform()) return

    const role = userProfile.role
    if (role === 'admin') return   // admin is the one posting — no self-notification

    // Delay flag: ignore items that existed before we subscribed
    let annReady  = false
    let newsReady = false
    const t1 = setTimeout(() => { annReady  = true }, 2000)
    const t2 = setTimeout(() => { newsReady = true }, 2000)

    const unsubAnn = onChildAdded(ref(db, 'ssmms/announcements'), async snap => {
      if (!annReady) return
      const ann = snap.val()
      if (!ann?.title) return
      if (ann.targetRoles && !ann.targetRoles.includes(role)) return
      await showLocalNotif(ann.title, ann.body || '', 'announcement')
    })

    const TYPE_ICON = { announcement: '📢', event: '📅', news: '📰' }
    const unsubNews = onChildAdded(ref(db, 'ssmms/news'), async snap => {
      if (!newsReady) return
      const article = snap.val()
      if (!article?.title) return
      const icon = TYPE_ICON[article.type] || '📰'
      await showLocalNotif(`${icon} ${article.title}`, (article.body || '').substring(0, 100), 'news')
    })

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      unsubAnn()
      unsubNews()
    }
  }, [currentUser, userProfile?.role])

  // ── Schedule local timetable notifications (students only) ────────────────
  useEffect(() => {
    if (!currentUser || userProfile?.role !== 'student') return
    if (!Capacitor.isNativePlatform()) return

    let unsubStudents = null

    unsubStudents = onValue(ref(db, 'ssmms/students'), snap => {
      let student = null
      const data = snap.val() || {}
      for (const [key, s] of Object.entries(data)) {
        if (s.linkedStudentUid === currentUser.uid || key === currentUser.uid) {
          student = { key, ...s }
          break
        }
      }
      if (!student?.classKey) return

      if (timetableUnsub.current) { timetableUnsub.current(); timetableUnsub.current = null }

      timetableUnsub.current = onValue(ref(db, `ssmms/timetable/${student.classKey}`), async ttSnap => {
        if (!ttSnap.exists()) return
        await scheduleTimetableNotifications(ttSnap.val(), student.classGrade || 'Class')
      })
    })

    return () => {
      if (unsubStudents) unsubStudents()
      if (timetableUnsub.current) { timetableUnsub.current(); timetableUnsub.current = null }
    }
  }, [currentUser, userProfile?.role])

  // ── Web browser: FCM for desktop testing ─────────────────────────────────
  useEffect(() => {
    if (!currentUser || Capacitor.isNativePlatform()) return

    ;(async () => {
      try {
        const { messaging } = await import('../firebase/config')
        if (!messaging) return
        const { getToken, onMessage } = await import('firebase/messaging')

        const raw = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        })
        if (!raw) return

        await set(ref(db, `ssmms/users/${currentUser.uid}/fcmTokens/${tokenKey(raw)}`), raw)

        onMessage(messaging, payload => {
          const { title, body } = payload.notification || {}
          if (title && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body })
          }
        })
      } catch (_) {}
    })()
  }, [currentUser])
}
