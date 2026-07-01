// ── Time helpers ─────────────────────────────────────────────────────────────

export function parseTime(t = '00:00') {
  const [h, m] = (t || '00:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function formatTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// Compute period schedule for each day type.
// Breaks have real clock startTime/endTime; periods slot in around them.
// Returns { [dayTypeKey]: [{ period, start, end }] }
export function computePeriodTimes(config) {
  const { startTime = '07:30', dayTypes = {}, breaks = [] } = config
  const sorted = [...breaks].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime))
  const result = {}

  for (const [typeKey, typeConf] of Object.entries(dayTypes)) {
    if (typeConf.noLessons) { result[typeKey] = []; continue }

    const times   = []
    const endMin  = parseTime(typeConf.endTime || '16:00')
    const pLen    = Number(typeConf.periodLength) || 40
    let cur       = parseTime(startTime)
    let periodNum = 1

    while (cur < endMin) {
      // Skip past any break we are currently inside
      const inBrk = sorted.find(b => parseTime(b.startTime) <= cur && parseTime(b.endTime) > cur)
      if (inBrk) { cur = parseTime(inBrk.endTime); continue }

      // Next boundary = start of next break OR end of day (whichever is sooner)
      const nextBrk  = sorted.find(b => parseTime(b.startTime) > cur)
      const boundary = nextBrk ? Math.min(parseTime(nextBrk.startTime), endMin) : endMin

      if (cur + pLen <= boundary) {
        times.push({ period: periodNum++, start: formatTime(cur), end: formatTime(cur + pLen) })
        cur += pLen
      } else if (nextBrk && parseTime(nextBrk.startTime) < endMin) {
        // Gap before break — jump over
        cur = parseTime(nextBrk.endTime)
      } else {
        break
      }
    }
    result[typeKey] = times
  }
  return result
}

// ── Clash detector ────────────────────────────────────────────────────────────
// Returns Set of strings: "teacherUid|day|period"
export function detectClashes(fullTimetable) {
  const clashes = new Set()
  const seen    = {}

  for (const [classKey, days] of Object.entries(fullTimetable)) {
    for (const [day, periods] of Object.entries(days)) {
      for (const [period, slot] of Object.entries(periods)) {
        if (!slot?.teacherUid) continue
        const key = `${slot.teacherUid}|${day}|${period}`
        if (seen[key] && seen[key] !== classKey) clashes.add(key)
        else seen[key] = classKey
      }
    }
  }
  return clashes
}

// ── Generator ─────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateTimetable(assignments, config) {
  const DAYS       = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  const periodMap  = computePeriodTimes(config)

  // Get period numbers available for each day
  const dayPeriods = {}
  for (const day of DAYS) {
    const dt = config.weekSchedule?.[day] || 'fullDay'
    dayPeriods[day] = (periodMap[dt] || []).map(p => p.period)
  }

  // Empty grids
  const timetable  = {}
  const teacherBusy = {}

  for (const classKey of Object.keys(assignments)) {
    timetable[classKey] = {}
    for (const day of DAYS) {
      timetable[classKey][day] = {}
      for (const p of (dayPeriods[day] || [])) timetable[classKey][day][p] = null
    }
  }

  // Flatten lessons
  const lessons = []
  for (const [classKey, subjects] of Object.entries(assignments)) {
    for (const [subjectKey, asgn] of Object.entries(subjects)) {
      if (!asgn.teacherUid || !Number(asgn.periodsPerWeek)) continue
      for (let i = 0; i < Number(asgn.periodsPerWeek); i++) {
        lessons.push({ classKey, subjectKey, ...asgn })
      }
    }
  }

  shuffle(lessons)

  const unplaced = []

  for (const lesson of lessons) {
    let placed = false

    for (const day of shuffle([...DAYS])) {
      const available = dayPeriods[day] || []
      for (const period of shuffle([...available])) {
        if (timetable[lesson.classKey]?.[day]?.[period] !== null) continue

        if (!teacherBusy[lesson.teacherUid]) teacherBusy[lesson.teacherUid] = {}
        if (!teacherBusy[lesson.teacherUid][day]) teacherBusy[lesson.teacherUid][day] = new Set()
        if (teacherBusy[lesson.teacherUid][day].has(period)) continue

        const dt    = config.weekSchedule?.[day] || 'fullDay'
        const times = (periodMap[dt] || []).find(p => p.period === period)

        timetable[lesson.classKey][day][period] = {
          subjectKey:  lesson.subjectKey,
          subjectName: lesson.subjectName,
          teacherUid:  lesson.teacherUid,
          teacherName: lesson.teacherName,
          startTime:   times?.start || '',
          endTime:     times?.end   || '',
        }
        teacherBusy[lesson.teacherUid][day].add(period)
        placed = true
        break
      }
      if (placed) break
    }

    if (!placed) unplaced.push(lesson)
  }

  return { timetable, unplaced }
}

// ── Colours ───────────────────────────────────────────────────────────────────

const COLOURS = [
  'bg-blue-100   text-blue-800   border-blue-300',
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-violet-100 text-violet-800 border-violet-300',
  'bg-amber-100  text-amber-800  border-amber-300',
  'bg-rose-100   text-rose-800   border-rose-300',
  'bg-cyan-100   text-cyan-800   border-cyan-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-teal-100   text-teal-800   border-teal-300',
  'bg-pink-100   text-pink-800   border-pink-300',
  'bg-lime-100   text-lime-800   border-lime-300',
]
export function subjectColour(key = '') {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % COLOURS.length
  return COLOURS[Math.abs(h)]
}
