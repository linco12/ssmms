import { Capacitor } from '@capacitor/core'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_BASE = { monday: 100, tuesday: 200, wednesday: 300, thursday: 400, friday: 500 }
const LEAD_MINUTES = 10

function buildScheduledAt(timeStr, offsetDays = 0) {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(h, m - LEAD_MINUTES, 0, 0)
  return d
}

export async function scheduleTimetableNotifications(timetable, className) {
  if (!Capacitor.isNativePlatform()) return

  const { LocalNotifications } = await import('@capacitor/local-notifications')

  // Android 8+ requires an explicit channel before any notification will appear
  await LocalNotifications.createChannel({
    id: 'ssmms_timetable',
    name: 'Class Reminders',
    description: 'Alerts 10 minutes before each class period',
    importance: 5,      // IMPORTANCE_HIGH → heads-up banner + vibration
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#0D3B66',
    sound: 'default',
  })

  const perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return

  const notifications = []
  const now = new Date()
  const todayIdx = now.getDay()

  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const targetDayIdx = (todayIdx + dayOffset) % 7
    const dayKey = DAY_KEYS[targetDayIdx]
    if (dayKey === 'saturday' || dayKey === 'sunday') continue

    const daySlots = timetable[dayKey] || {}
    const base = DAY_BASE[dayKey] || 100

    Object.entries(daySlots).forEach(([period, slot]) => {
      if (!slot?.subjectName || !slot?.startTime) return
      const fireAt = buildScheduledAt(slot.startTime, dayOffset)
      if (fireAt <= now) return

      const teacher = slot.teacherName ? ` · ${slot.teacherName}` : ''
      const note = slot.label ? ` (${slot.label})` : ''

      notifications.push({
        id: base + parseInt(period),
        channelId: 'ssmms_timetable',
        title: `📚 ${slot.subjectName} in ${LEAD_MINUTES} min`,
        body: `Period ${period} — ${className}${teacher}${note}`,
        schedule: { at: fireAt, allowWhileIdle: true },
        sound: 'default',
        smallIcon: 'ic_stat_notification',
        iconColor: '#0D3B66',
        extra: { type: 'timetable', period, dayKey },
      })
    })
  }

  if (notifications.length === 0) return

  // Cancel previous timetable notifications before rescheduling
  try {
    const idsToCancel = []
    Object.values(DAY_BASE).forEach(base => {
      for (let p = 1; p <= 8; p++) idsToCancel.push({ id: base + p })
    })
    await LocalNotifications.cancel({ notifications: idsToCancel })
  } catch (_) {}

  await LocalNotifications.schedule({ notifications })
}

export async function cancelAllTimetableNotifications() {
  if (!Capacitor.isNativePlatform()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const ids = []
  Object.values(DAY_BASE).forEach(base => {
    for (let p = 1; p <= 8; p++) ids.push({ id: base + p })
  })
  await LocalNotifications.cancel({ notifications: ids })
}
