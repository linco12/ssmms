const { onValueCreated } = require('firebase-functions/v2/database')
const { onSchedule }     = require('firebase-functions/v2/scheduler')
const { initializeApp }  = require('firebase-admin/app')
const { getDatabase }    = require('firebase-admin/database')
const { getMessaging }   = require('firebase-admin/messaging')

initializeApp()

// ─── helpers ────────────────────────────────────────────────────────────────

async function getTokensForRoles(roles) {
  const db = getDatabase()
  const snap = await db.ref('users').once('value')
  const tokens = []
  snap.forEach(child => {
    const u = child.val()
    if (!roles || roles.includes(u.role)) {
      // Tokens are stored as VALUES (keys are just safe identifiers)
      Object.values(u.fcmTokens || {}).forEach(t => { if (t && typeof t === 'string') tokens.push(t) })
    }
  })
  return [...new Set(tokens)]
}

async function sendMulticast(tokens, title, body, data = {}) {
  if (tokens.length === 0) return
  // Firebase allows max 500 tokens per multicast
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500)
    await getMessaging().sendEachForMulticast({
      notification: { title, body },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'ssmms_default' },
      },
      data: { ...data },
      tokens: batch,
    })
  }
}

// ─── 1. New announcement → notify targeted roles immediately ────────────────
exports.onAnnouncementCreated = onValueCreated(
  { ref: '/announcements/{id}', region: 'us-central1' },
  async event => {
    const ann = event.data.val()
    if (!ann?.title) return

    const roles = ann.targetRoles || ['student', 'parent', 'teacher']
    const tokens = await getTokensForRoles(roles)
    await sendMulticast(tokens, ann.title, ann.body || '', { type: 'announcement' })
  }
)

// ─── 2. New news / event article posted → notify all users ──────────────────
exports.onNewsCreated = onValueCreated(
  { ref: '/news/{id}', region: 'us-central1' },
  async event => {
    const article = event.data.val()
    if (!article?.title) return

    const TYPE_LABEL = {
      announcement: '📢 School Announcement',
      event:        '📅 School Event',
      news:         '📰 School News',
    }

    const notifTitle = TYPE_LABEL[article.type] || '📰 School News'
    const notifBody  = article.title + (article.body ? ` — ${article.body.substring(0, 80)}` : '')

    const tokens = await getTokensForRoles(null)   // all roles
    await sendMulticast(tokens, notifTitle, notifBody, {
      type:        'news',
      articleType: article.type || 'news',
    })
  }
)

// ─── 3. Timetable alerts — runs every 5 minutes ─────────────────────────────
exports.scheduledTimetableAlerts = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Africa/Harare', region: 'us-central1' },
  async _event => {
    const db = getDatabase()
    const now  = new Date()
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    const today = days[now.getDay()]
    if (today === 'saturday' || today === 'sunday') return

    // Target time = now + 10 minutes
    const target = new Date(now.getTime() + 10 * 60 * 1000)
    const hh = String(target.getHours()).padStart(2, '0')
    const mm = String(target.getMinutes()).padStart(2, '0')
    const targetTime = `${hh}:${mm}`

    const [ttSnap, classesSnap, studentsSnap] = await Promise.all([
      db.ref('timetable').once('value'),
      db.ref('classes').once('value'),
      db.ref('students').once('value'),
    ])

    if (!ttSnap.exists()) return

    // Build class name map
    const classNames = {}
    classesSnap.forEach(c => { classNames[c.key] = c.val().name })

    // Build classKey → [linkedStudentUid] map
    const classToUids = {}
    studentsSnap.forEach(s => {
      const st = s.val()
      if (st.classKey && st.enrollmentStatus === 'Active' && st.linkedStudentUid) {
        if (!classToUids[st.classKey]) classToUids[st.classKey] = []
        classToUids[st.classKey].push(st.linkedStudentUid)
      }
    })

    // Get all FCM tokens per uid
    const usersSnap = await db.ref('users').once('value')
    const uidToTokens = {}
    usersSnap.forEach(u => {
      const user = u.val()
      uidToTokens[u.key] = Object.values(user.fcmTokens || {}).filter(t => t && typeof t === 'string')
    })

    // Find classes with a period starting at targetTime
    const timetable = ttSnap.val()
    for (const [classKey, dayMap] of Object.entries(timetable)) {
      const daySlots = dayMap[today] || {}
      for (const [period, slot] of Object.entries(daySlots)) {
        if (slot?.startTime !== targetTime || !slot?.subjectName) continue

        const uids = classToUids[classKey] || []
        const tokens = uids.flatMap(uid => uidToTokens[uid] || [])
        if (tokens.length === 0) continue

        const className = classNames[classKey] || classKey
        const teacher = slot.teacherName ? ` · ${slot.teacherName}` : ''
        await sendMulticast(
          tokens,
          `${slot.subjectName} in 10 minutes`,
          `Period ${period} — ${className}${teacher}`,
          { type: 'timetable', classKey, period: String(period) }
        )
      }
    }
  }
)

// ─── 3. Event reminders — runs daily at 7:00 AM, for events happening today ─
exports.scheduledEventReminders = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'Africa/Harare', region: 'us-central1' },
  async _event => {
    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0]

    const eventsSnap = await db.ref('calendarEvents').once('value')
    const todayEvents = []
    eventsSnap.forEach(c => {
      const ev = c.val()
      if (ev.date === today || ev.startDate === today) {
        todayEvents.push(ev.title)
      }
    })
    if (todayEvents.length === 0) return

    const tokens = await getTokensForRoles(null)  // all roles
    const body = todayEvents.join(' · ')
    await sendMulticast(tokens, "Today's School Events", body, { type: 'event' })
  }
)

// ─── 5. New assignment posted → notify students in the class ────────────────
exports.onAssignmentCreated = onValueCreated(
  { ref: '/assignments/{id}', region: 'us-central1' },
  async event => {
    const assignment = event.data.val()
    if (!assignment?.title || !assignment?.classKey) return

    const db = getDatabase()
    const studentsSnap = await db.ref('students').once('value')
    const uids = []
    studentsSnap.forEach(s => {
      const st = s.val()
      if (st.classKey === assignment.classKey && st.linkedStudentUid && st.enrollmentStatus === 'Active') {
        uids.push(st.linkedStudentUid)
      }
    })
    if (uids.length === 0) return

    const deadlineStr = assignment.deadline
      ? new Date(assignment.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'No deadline set'

    const notifTitle = `📝 New Assignment: ${assignment.title}`
    const notifBody  = `${assignment.className || assignment.classKey} — Due: ${deadlineStr}`

    // In-app notifications for each student
    const writePromises = uids.map(uid =>
      db.ref(`notifications/${uid}`).push({
        title: notifTitle,
        body: notifBody,
        type: 'assignment',
        read: false,
        timestamp: Date.now(),
      })
    )
    await Promise.all(writePromises)

    // FCM push
    const usersSnap = await db.ref('users').once('value')
    const tokens = []
    usersSnap.forEach(u => {
      if (uids.includes(u.key)) {
        Object.values(u.val().fcmTokens || {}).forEach(t => { if (t && typeof t === 'string') tokens.push(t) })
      }
    })
    await sendMulticast(tokens, notifTitle, notifBody, { type: 'assignment' })
  }
)

// ─── 6. Targeted notification (class or individual) → FCM + in-app ──────────
exports.onTargetedNotificationCreated = onValueCreated(
  { ref: '/targetedNotifications/{id}', region: 'us-central1' },
  async event => {
    const notif = event.data.val()
    if (!notif?.title) return

    const db = getDatabase()
    let uids = []

    if (notif.targetType === 'class' && notif.classKey) {
      const studentsSnap = await db.ref('students').once('value')
      studentsSnap.forEach(s => {
        const st = s.val()
        if (st.classKey === notif.classKey && st.linkedStudentUid && st.enrollmentStatus === 'Active') {
          uids.push(st.linkedStudentUid)
        }
      })
    } else if (notif.targetType === 'student' && notif.targetUid) {
      uids = [notif.targetUid]
    }

    if (uids.length === 0) return

    const writePromises = uids.map(uid =>
      db.ref(`notifications/${uid}`).push({
        title: notif.title,
        body: notif.body || '',
        type: 'targeted',
        read: false,
        timestamp: Date.now(),
      })
    )
    await Promise.all(writePromises)

    const usersSnap = await db.ref('users').once('value')
    const tokens = []
    usersSnap.forEach(u => {
      if (uids.includes(u.key)) {
        Object.values(u.val().fcmTokens || {}).forEach(t => { if (t && typeof t === 'string') tokens.push(t) })
      }
    })
    await sendMulticast(tokens, notif.title, notif.body || '', { type: 'targeted' })
  }
)

// ─── 7. Attendance reminder — runs at 9:30 AM every school day ──────────────
exports.attendanceReminder = onSchedule(
  { schedule: '30 9 * * 1-5', timeZone: 'Africa/Harare', region: 'us-central1' },
  async _event => {
    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')

    const [usersSnap, classesSnap] = await Promise.all([
      db.ref('users').once('value'),
      db.ref('classes').once('value'),
    ])

    // Build classKey → class name map
    const classKeyMap = {}  // classKey → name
    const classNameMap = {} // name → classKey
    classesSnap.forEach(c => {
      classKeyMap[c.key] = c.val().name
      classNameMap[c.val().name] = c.key
    })

    // Build uid → tokens map
    const uidToTokens = {}
    usersSnap.forEach(u => {
      uidToTokens[u.key] = Object.values(u.val().fcmTokens || {}).filter(t => t && typeof t === 'string')
    })

    // For each teacher with an assignedClass, check if today's attendance is marked
    const notifications = []
    usersSnap.forEach(u => {
      const user = u.val()
      if (user.role !== 'teacher' || !user.assignedClass) return
      const ck = classNameMap[user.assignedClass] || user.assignedClass
      notifications.push({ uid: u.key, tokens: uidToTokens[u.key] || [], className: user.assignedClass, classKey: ck })
    })

    // Check attendance records
    const attendanceSnap = await db.ref('attendance').once('value')
    const attendance = attendanceSnap.val() || {}

    for (const teacher of notifications) {
      if (teacher.tokens.length === 0) continue
      const dayRecord = attendance[teacher.classKey]?.[today]
      if (!dayRecord) {
        await sendMulticast(
          teacher.tokens,
          '📋 Attendance Reminder',
          `You haven't marked attendance for ${teacher.className} yet today. Please do it now.`,
          { type: 'attendance_reminder' }
        )
      }
    }
  }
)

// ─── 4. Tomorrow's event reminders — runs daily at 8:00 PM ──────────────────
exports.scheduledTomorrowReminders = onSchedule(
  { schedule: '0 20 * * *', timeZone: 'Africa/Harare', region: 'us-central1' },
  async _event => {
    const db = getDatabase()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const eventsSnap = await db.ref('calendarEvents').once('value')
    const tomorrowEvents = []
    eventsSnap.forEach(c => {
      const ev = c.val()
      if (ev.date === tomorrowStr || ev.startDate === tomorrowStr) {
        tomorrowEvents.push(ev.title)
      }
    })
    if (tomorrowEvents.length === 0) return

    const tokens = await getTokensForRoles(null)
    const body = tomorrowEvents.join(' · ')
    await sendMulticast(tokens, "Tomorrow's School Events", body, { type: 'event' })
  }
)
