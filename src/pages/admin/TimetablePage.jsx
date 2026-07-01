import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { ref, onValue, set } from 'firebase/database'
import {
  computePeriodTimes, generateTimetable, detectClashes, subjectColour
} from '../../utils/timetableGenerator'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const DAYS      = ['monday','tuesday','wednesday','thursday','friday']
const DAY_LABEL = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri' }

const DEFAULT_CONFIG = {
  startTime: '07:30',
  dayTypes: {
    fullDay:   { label:'Full Day',    endTime:'16:00', periodLength:40 },
    halfDay:   { label:'Half Day',    endTime:'12:30', periodLength:40 },
    sportsDay: { label:'Sports Day',  endTime:'13:00', periodLength:60 },
    noLesson:  { label:'No Lessons',  endTime:'16:00', periodLength:40, noLessons:true },
  },
  breaks: [
    { id:'b1', label:'Short Break', startTime:'10:00', endTime:'10:15' },
    { id:'b2', label:'Lunch',       startTime:'12:30', endTime:'13:30' },
  ],
  weekSchedule: { monday:'fullDay', tuesday:'fullDay', wednesday:'fullDay', thursday:'fullDay', friday:'fullDay' },
}

// Migrate old config (breaks had afterPeriod instead of startTime/endTime)
function sanitiseConfig(raw) {
  if (!raw) return DEFAULT_CONFIG
  const hasMigrated = raw.breaks?.[0]?.startTime !== undefined
  if (!hasMigrated) return { ...DEFAULT_CONFIG, weekSchedule: raw.weekSchedule || DEFAULT_CONFIG.weekSchedule }
  return raw
}

const inp  = 'border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0D3B66] w-full'
const Btn  = ({ children, onClick, disabled, variant='blue', className:cx='' }) => (
  <button onClick={onClick} disabled={disabled}
    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 ${cx}
      ${variant==='blue'  ? 'bg-[#0D3B66] text-white hover:bg-[#0a2e52]' : ''}
      ${variant==='ghost' ? 'border border-slate-300 text-slate-600 hover:bg-slate-50' : ''}
      ${variant==='red'   ? 'text-red-400 hover:text-red-600 text-lg leading-none px-1' : ''}`}>
    {children}
  </button>
)

// ── PDF helpers ───────────────────────────────────────────────────────────────

function pdfHeader(doc, title, subtitle) {
  doc.setFillColor(13, 59, 102)
  doc.rect(0, 0, doc.internal.pageSize.width, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(title, doc.internal.pageSize.width / 2, 10, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitle, doc.internal.pageSize.width / 2, 17, { align: 'center' })
  doc.setTextColor(0, 0, 0)
}

function buildPdfBreakRows(allPeriods, config, periodMap) {
  const breaks = [...(config.breaks||[])].sort((a,b)=>a.startTime.localeCompare(b.startTime))
  const result = {}
  for (let i = 1; i < allPeriods.length; i++) {
    const prev = allPeriods[i-1], cur = allPeriods[i]
    const mondayType = config.weekSchedule?.monday||'fullDay'
    const prevEnd  = (periodMap[mondayType]||[]).find(p=>p.period===prev)?.end
    const curStart = (periodMap[mondayType]||[]).find(p=>p.period===cur)?.start
    for (const brk of breaks) {
      if (prevEnd && curStart && brk.startTime >= prevEnd && brk.endTime <= curStart) {
        if (!result[cur]) result[cur] = []
        result[cur].push(brk)
      }
    }
  }
  return result
}

function downloadClassPDF(className, classTt, allPeriods, config, periodMap) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pdfHeader(doc, 'School Timetable', className)

  const breaksBefore = buildPdfBreakRows(allPeriods, config, periodMap)
  const mondayDt = config.weekSchedule?.monday||'fullDay'

  const body = []
  for (const period of allPeriods) {
    // Insert break separator rows before this period if needed
    for (const brk of (breaksBefore[period]||[])) {
      body.push([{
        content: `${brk.label}   ${brk.startTime} – ${brk.endTime}`,
        colSpan: 6,
        styles: { fillColor: [241,245,249], textColor: [100,116,139], fontStyle:'italic', halign:'center', fontSize:7 }
      }])
    }
    const times = (periodMap[mondayDt]||[]).find(p=>p.period===period)
    const periodLabel = times ? `Period ${period}\n${times.start} – ${times.end}` : `Period ${period}`
    const row = [{ content: periodLabel, styles: { fontStyle:'bold', fillColor:[248,250,252] } }]
    for (const day of DAYS) {
      const dt = config.weekSchedule?.[day]||'fullDay'
      const dayConf = config.dayTypes?.[dt]
      const periods = (periodMap[dt]||[]).map(p=>p.period)
      const slot = classTt[day]?.[period]
      if (dayConf?.noLessons) row.push({ content: 'No Lessons', styles:{fillColor:[248,250,252],textColor:[148,163,184],halign:'center'} })
      else if (!periods.includes(period)) row.push({ content:'', styles:{fillColor:[248,250,252]} })
      else if (slot) row.push({ content: `${slot.subjectName}\n${slot.teacherName}`, styles:{fontSize:7} })
      else row.push({ content: 'Free', styles:{textColor:[203,213,225],halign:'center'} })
    }
    body.push(row)
  }

  doc.autoTable({
    head: [['Period', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']],
    body,
    startY: 26,
    styles:      { fontSize: 8, cellPadding: 2.5, lineColor:[220,220,220], lineWidth:0.2 },
    headStyles:  { fillColor:[13,59,102], textColor:255, fontStyle:'bold', halign:'center' },
    columnStyles:{ 0:{ cellWidth:30, halign:'center' } },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 10, doc.internal.pageSize.height - 5, { align:'right' })
    doc.text(`Generated ${new Date().toLocaleDateString()}`, 10, doc.internal.pageSize.height - 5)
  }

  doc.save(`Timetable-${className.replace(/\s+/g,'-')}.pdf`)
}

function downloadTeacherPDF(teacherName, myGrid, allPeriods, config, periodMap, classes) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pdfHeader(doc, 'Teacher Timetable', teacherName)

  const breaksBefore = buildPdfBreakRows(allPeriods, config, periodMap)
  const mondayDt = config.weekSchedule?.monday||'fullDay'

  const totalPds = Object.values(myGrid).reduce((s,d)=>s+Object.keys(d).length, 0)

  const body = []
  for (const period of allPeriods) {
    for (const brk of (breaksBefore[period]||[])) {
      body.push([{
        content: `${brk.label}   ${brk.startTime} – ${brk.endTime}`,
        colSpan: 6,
        styles: { fillColor:[241,245,249], textColor:[100,116,139], fontStyle:'italic', halign:'center', fontSize:7 }
      }])
    }
    const times = (periodMap[mondayDt]||[]).find(p=>p.period===period)
    const periodLabel = times ? `Period ${period}\n${times.start} – ${times.end}` : `Period ${period}`
    const row = [{ content: periodLabel, styles:{ fontStyle:'bold', fillColor:[248,250,252] } }]
    for (const day of DAYS) {
      const dt = config.weekSchedule?.[day]||'fullDay'
      const dayConf = config.dayTypes?.[dt]
      const periods = (periodMap[dt]||[]).map(p=>p.period)
      const slot = myGrid[day]?.[period]
      if (dayConf?.noLessons) row.push({ content:'No Lessons', styles:{fillColor:[248,250,252],textColor:[148,163,184],halign:'center'} })
      else if (!periods.includes(period)) row.push({ content:'', styles:{fillColor:[248,250,252]} })
      else if (slot) row.push({ content:`${slot.subjectName}\n${slot.className}`, styles:{fontSize:7} })
      else row.push({ content:'Free', styles:{textColor:[203,213,225],halign:'center'} })
    }
    body.push(row)
  }

  doc.autoTable({
    head: [['Period', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']],
    body,
    startY: 26,
    styles:      { fontSize:8, cellPadding:2.5, lineColor:[220,220,220], lineWidth:0.2 },
    headStyles:  { fillColor:[13,59,102], textColor:255, fontStyle:'bold', halign:'center' },
    columnStyles:{ 0:{ cellWidth:30, halign:'center' } },
  })

  doc.setFontSize(8)
  doc.setTextColor(80)
  doc.text(`Total: ${totalPds} periods/week`, 10, doc.internal.pageSize.height - 5)
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 10, doc.internal.pageSize.height - 5, { align:'right' })
  }

  doc.save(`Timetable-${teacherName.replace(/\s+/g,'-')}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const [tab, setTab]                 = useState('schedule')
  const [classes, setClasses]         = useState([])
  const [subjects, setSubjects]       = useState([])
  const [classSubjects, setClassSubjects] = useState({})
  const [teachers, setTeachers]       = useState([])
  const [config, setConfig]           = useState(DEFAULT_CONFIG)
  const [assignments, setAssignments] = useState({})
  const [timetable, setTimetable]     = useState({})

  useEffect(() => {
    const uns = [
      onValue(ref(db,'classes'),      snap => { const l=[]; snap.forEach(c=>{const v=c.val();if(v&&v.name)l.push({key:c.key,...v})}); l.sort((a,b)=>(a.form||0)-(b.form||0)||(a.section||'').localeCompare(b.section||'')); setClasses(l) }),
      onValue(ref(db,'subjects'),     snap => { const l=[]; snap.forEach(c=>l.push({key:c.key,...c.val()})); l.sort((a,b)=>(a.name||'').localeCompare(b.name||'')); setSubjects(l) }),
      onValue(ref(db,'classSubjects'),snap => setClassSubjects(snap.val()||{})),
      onValue(ref(db,'users'),        snap => { const l=[]; snap.forEach(c=>{const u=c.val();if(u.role==='teacher')l.push({uid:c.key,...u})}); l.sort((a,b)=>(a.displayName||'').localeCompare(b.displayName||'')); setTeachers(l) }),
      onValue(ref(db,'timetableConfig/schedule'),   snap => { if(snap.exists()) setConfig(sanitiseConfig(snap.val())) }),
      onValue(ref(db,'timetableConfig/assignments'),snap => setAssignments(snap.val()||{})),
      onValue(ref(db,'timetable'),    snap => setTimetable(snap.val()||{})),
    ]
    return () => uns.forEach(u=>u())
  }, [])

  const TABS = [
    { id:'schedule',    label:'🕐 Schedule' },
    { id:'assignments', label:'👨‍🏫 Assignments' },
    { id:'timetable',  label:'📅 Timetable' },
    { id:'teacher',    label:'👤 Teacher View' },
  ]

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Timetable Management</h1>
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${tab===t.id ? 'border-[#0D3B66] text-[#0D3B66]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='schedule'    && <ScheduleTab    config={config} setConfig={setConfig} />}
      {tab==='assignments' && <AssignmentsTab config={config} assignments={assignments} setAssignments={setAssignments} classes={classes} teachers={teachers} />}
      {tab==='timetable'  && <TimetableTab   config={config} assignments={assignments} timetable={timetable} setTimetable={setTimetable} classes={classes} />}
      {tab==='teacher'    && <TeacherViewTab  timetable={timetable} teachers={teachers} config={config} classes={classes} />}
    </div>
  )
}

// ── Tab 1: Schedule Setup ─────────────────────────────────────────────────────

function ScheduleTab({ config, setConfig }) {
  const [local, setLocal]   = useState(config)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => setLocal(config), [config])

  const patch = (path, val) => setLocal(prev => {
    const n = JSON.parse(JSON.stringify(prev))
    path.split('.').reduce((o,k,i,a) => i===a.length-1 ? (o[k]=val) : o[k], n)
    return n
  })

  const addDayType = () => {
    const id = `type_${Date.now()}`
    setLocal(p=>({...p, dayTypes:{...p.dayTypes, [id]:{label:'New Type', endTime:'16:00', periodLength:40}}}))
  }
  const removeDayType = id => setLocal(p=>{ const dt={...p.dayTypes}; delete dt[id]; return {...p,dayTypes:dt} })

  const addBreak = () => setLocal(p=>({...p, breaks:[...(p.breaks||[]),{id:`b_${Date.now()}`,label:'Break',startTime:'10:00',endTime:'10:15'}]}))
  const removeBreak = id => setLocal(p=>({...p,breaks:p.breaks.filter(b=>b.id!==id)}))
  const patchBreak  = (id,k,v) => setLocal(p=>({...p,breaks:p.breaks.map(b=>b.id===id?{...b,[k]:v}:b)}))

  const save = async () => {
    setSaving(true)
    await set(ref(db,'timetableConfig/schedule'), local)
    setConfig(local); setSaving(false); setSaved(true)
    setTimeout(()=>setSaved(false), 2000)
  }

  const periodTimes = computePeriodTimes(local)

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Global start time */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-700 mb-4">School Day Start</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600 w-28 shrink-0">Lessons start at</label>
          <input type="time" value={local.startTime||'07:30'} onChange={e=>patch('startTime',e.target.value)} className={`${inp} w-36`} />
        </div>
      </section>

      {/* Day types */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Day Types</h2>
          <Btn variant="ghost" onClick={addDayType}>+ Add type</Btn>
        </div>
        <div className="space-y-4">
          {Object.entries(local.dayTypes||{}).map(([id,dt])=>(
            <div key={id} className="border border-slate-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input value={dt.label} onChange={e=>patch(`dayTypes.${id}.label`,e.target.value)}
                  className={`${inp} w-36`} placeholder="Label" />
                <label className="flex items-center gap-1.5 text-sm text-slate-600 ml-2">
                  <input type="checkbox" checked={!!dt.noLessons} onChange={e=>patch(`dayTypes.${id}.noLessons`,e.target.checked)} />
                  No lessons
                </label>
                {Object.keys(local.dayTypes).length>1 && (
                  <Btn variant="red" onClick={()=>removeDayType(id)}>×</Btn>
                )}
              </div>
              {!dt.noLessons && (
                <div className="flex items-center gap-4 flex-wrap pl-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-slate-500">End time</label>
                    <input type="time" value={dt.endTime||'16:00'} onChange={e=>patch(`dayTypes.${id}.endTime`,e.target.value)} className={`${inp} w-32`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-slate-500">Period length</label>
                    <input type="number" min="1" value={dt.periodLength||40} onChange={e=>patch(`dayTypes.${id}.periodLength`,Number(e.target.value))} className={`${inp} w-20`} />
                    <span className="text-xs text-slate-400">min</span>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                    → {(periodTimes[id]||[]).length} periods
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Breaks */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Breaks & Lunch</h2>
          <Btn variant="ghost" onClick={addBreak}>+ Add break</Btn>
        </div>
        {!(local.breaks||[]).length && <p className="text-sm text-slate-400">No breaks yet.</p>}
        <div className="space-y-3">
          {(local.breaks||[]).map(b=>(
            <div key={b.id} className="flex items-center gap-3 flex-wrap border border-slate-100 rounded-lg p-2.5">
              <input value={b.label} onChange={e=>patchBreak(b.id,'label',e.target.value)}
                className={`${inp} w-32`} placeholder="Name" />
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500">From</label>
                <input type="time" value={b.startTime||'10:00'} onChange={e=>patchBreak(b.id,'startTime',e.target.value)} className={`${inp} w-32`} />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500">To</label>
                <input type="time" value={b.endTime||'10:15'} onChange={e=>patchBreak(b.id,'endTime',e.target.value)} className={`${inp} w-32`} />
              </div>
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                {Math.round((b.endTime&&b.startTime) ? (b.endTime.split(':')[0]*60+Number(b.endTime.split(':')[1]))-(b.startTime.split(':')[0]*60+Number(b.startTime.split(':')[1])) : 0)} min
              </span>
              <Btn variant="red" onClick={()=>removeBreak(b.id)}>×</Btn>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly schedule */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Weekly Schedule</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {DAYS.map(day=>(
            <div key={day}>
              <label className="text-xs font-medium text-slate-600 block mb-1 capitalize">{day}</label>
              <select value={local.weekSchedule?.[day]||'fullDay'} onChange={e=>patch(`weekSchedule.${day}`,e.target.value)} className={inp}>
                {Object.entries(local.dayTypes||{}).map(([id,dt])=>(
                  <option key={id} value={id}>{dt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Live preview */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Period Times Preview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Object.entries(local.dayTypes||{}).map(([typeKey,dt])=>(
            <div key={typeKey}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{dt.label}</p>
              {dt.noLessons ? (
                <p className="text-xs text-slate-400 italic">No lessons scheduled</p>
              ) : (
                <div className="space-y-0.5">
                  {/* Merge periods + breaks into a sorted timeline */}
                  {buildTimeline(periodTimes[typeKey]||[], local.breaks||[]).map((item,i)=>(
                    item.type==='period' ? (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-slate-400 w-16">P{item.period}</span>
                        <span className="font-mono text-slate-700">{item.start} – {item.end}</span>
                      </div>
                    ) : (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-400 italic my-0.5">
                        <span className="w-16">☕</span>
                        <span>{item.label}  {item.startTime} – {item.endTime}</span>
                      </div>
                    )
                  ))}
                  {!(periodTimes[typeKey]||[]).length && <p className="text-xs text-slate-400">No periods fit — adjust times.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Schedule'}</Btn>
        {saved && <span className="text-sm text-green-600">✓ Saved</span>}
      </div>
    </div>
  )
}

function buildTimeline(periods, breaks) {
  const items = [
    ...periods.map(p=>({...p, type:'period', sortKey:p.start})),
    ...breaks.map(b=>({...b, type:'break',  sortKey:b.startTime})),
  ]
  return items.sort((a,b)=>a.sortKey.localeCompare(b.sortKey))
}

// ── Tab 2: Assignments ────────────────────────────────────────────────────────

function AssignmentsTab({ config, assignments, setAssignments, classes, teachers }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [subjects,      setSubjects]      = useState([])
  const [classSubjects, setClassSubjects] = useState({})

  // Own direct Firebase listeners — independent of parent state
  useEffect(() => {
    const u1 = onValue(ref(db,'subjects'), snap => {
      const l = []
      snap.forEach(c => { const v = c.val(); if (v && v.name) l.push({ key: c.key, ...v }) })
      l.sort((a,b) => a.name.localeCompare(b.name))
      setSubjects(l)
    })
    const u2 = onValue(ref(db,'classSubjects'), snap => setClassSubjects(snap.val()||{}))
    return () => { u1(); u2() }
  }, [])

  const cls         = classes.find(c=>c.key===selectedClass)
  const getA        = sk => assignments[selectedClass]?.[sk] || {}

  // Show subjects for selected class (from classSubjects), falling back to full list
  const subjectList = (() => {
    if (!selectedClass) return subjects
    const csKeys = Object.keys(classSubjects[selectedClass]||{})
    const matched = csKeys.map(k=>subjects.find(s=>s.key===k)).filter(Boolean)
    // If class has no valid classSubjects entries, show all subjects
    return matched.length ? matched : subjects
  })()

  const updateA = async (subjectKey, field, val) => {
    const subject  = subjects.find(s=>s.key===subjectKey)
    const teacher  = field==='teacherUid' ? teachers.find(t=>t.uid===val) : null
    const existing = getA(subjectKey)
    const merged   = { ...existing, subjectName: subject?.name || existing.subjectName || '', [field]: val }
    if (teacher) merged.teacherName = teacher.displayName || teacher.email
    if (!teacher && field==='teacherUid') merged.teacherName = ''
    await set(ref(db, `ssmms/timetableConfig/assignments/${selectedClass}/${subjectKey}`), merged)
    setAssignments(a => {
      const n = JSON.parse(JSON.stringify(a))
      if (!n[selectedClass]) n[selectedClass] = {}
      n[selectedClass][subjectKey] = merged
      return n
    })
  }

  const periodMap      = computePeriodTimes(config)
  const totalAvailable = DAYS.reduce((s,day)=>s+(periodMap[config.weekSchedule?.[day]||'fullDay']||[]).length, 0)
  const totalAssigned  = subjectList.reduce((s,sub)=>s+Number(getA(sub.key).periodsPerWeek||0), 0)
  const isOver         = totalAssigned > totalAvailable

  const sortedClasses = [...classes].sort((a,b) => {
    const fd = (a.form||0)-(b.form||0)
    return fd!==0 ? fd : (a.section||'').localeCompare(b.section||'')
  })

  return (
    <div className="space-y-4 max-w-4xl">

      {/* Class picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className={`${inp} w-48`}>
          <option value="">— Select class —</option>
          {sortedClasses.map(c=>(
            <option key={c.key} value={c.key}>{c.name}</option>
          ))}
        </select>

        {selectedClass && (
          <span className={`text-xs px-2 py-1 rounded font-semibold ${isOver?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>
            {totalAssigned} / {totalAvailable} periods/week{isOver?' ⚠ over capacity':''}
          </span>
        )}
        {selectedClass && !isOver && (
          <span className="text-xs text-slate-400">{Math.max(0,totalAvailable-totalAssigned)} free periods</span>
        )}
      </div>

      {/* Class teacher banner */}
      {cls && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex-wrap">
          <span className="text-sm text-blue-700 font-medium">{cls.name}</span>
          <span className="text-xs text-blue-500">Class Teacher:</span>
          <span className="text-sm font-semibold text-blue-800">{cls.teacherName||'— Not assigned —'}</span>
          <span className="text-xs text-blue-300 ml-auto">Set in Classes page</span>
        </div>
      )}

      {!selectedClass && (
        <p className="text-sm text-slate-400">Select a class above to assign teachers and periods.</p>
      )}

      {selectedClass && subjects.length>0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Subject</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Teacher for {cls?.name}</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-36">Periods / week</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjectList.map(subject=>{
                const asgn   = getA(subject.key)
                const colour = subjectColour(subject.key)
                const active = !!asgn.teacherUid || Number(asgn.periodsPerWeek)>0
                return (
                  <tr key={subject.key} className={`hover:bg-slate-50 ${active?'':'opacity-60'}`}>
                    <td className="px-4 py-2 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colour.split(' ')[0]}`} />
                        {subject.name}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select value={asgn.teacherUid||''} onChange={e=>updateA(subject.key,'teacherUid',e.target.value)} className={`${inp} w-52`}>
                        <option value="">— No teacher —</option>
                        {teachers.map(t=>(
                          <option key={t.uid} value={t.uid}>{t.displayName||t.email}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" min="0" max="30" value={asgn.periodsPerWeek||''} placeholder="0"
                        onChange={e=>updateA(subject.key,'periodsPerWeek',Number(e.target.value))}
                        className={`${inp} w-20`} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Teacher workload summary */}
      {selectedClass && subjectList.some(s=>getA(s.key).teacherUid) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Teachers assigned to {cls?.name}</p>
          <div className="space-y-1">
            {teachers.filter(t=>subjectList.some(s=>getA(s.key).teacherUid===t.uid)).map(t=>{
              const mine  = subjectList.filter(s=>getA(s.key).teacherUid===t.uid)
              const total = mine.reduce((s,sub)=>s+Number(getA(sub.key).periodsPerWeek||0),0)
              return (
                <div key={t.uid} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-700 w-40 truncate">{t.displayName||t.email}</span>
                  <span className="text-slate-400 text-xs">{mine.map(s=>s.name).join(', ')}</span>
                  <span className="ml-auto text-xs text-slate-500 shrink-0">{total} periods/wk</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Generated Timetable ────────────────────────────────────────────────

function TimetableTab({ config, assignments, timetable, setTimetable, classes }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [generating, setGenerating]       = useState(false)
  const [unplaced, setUnplaced]           = useState([])
  const [clashes, setClashes]             = useState(new Set())

  useEffect(()=>{ if(Object.keys(timetable).length) setClashes(detectClashes(timetable)) }, [timetable])

  const handleGenerate = async () => {
    if (!Object.keys(assignments).length) { alert('Set up teacher assignments first.'); return }
    setGenerating(true)
    const { timetable:newTt, unplaced:up } = generateTimetable(assignments, config)
    setUnplaced(up)
    await set(ref(db,'timetable'), newTt)
    setTimetable(newTt)
    setClashes(detectClashes(newTt))
    setGenerating(false)
  }

  const periodMap  = computePeriodTimes(config)
  const classTt    = selectedClass ? (timetable[selectedClass]||{}) : {}

  // All periods for the selected class's week
  const allPeriods = [...new Set(
    DAYS.flatMap(day => {
      const dt = config.weekSchedule?.[day]||'fullDay'
      return (periodMap[dt]||[]).map(p=>p.period)
    })
  )].sort((a,b)=>a-b)

  // Group classes by form for the dropdown
  const byForm = {}
  for (const cls of classes) { const f=cls.form||0; if(!byForm[f])byForm[f]=[]; byForm[f].push(cls) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={handleGenerate} disabled={generating}>
          {generating ? '⏳ Generating…' : '⚡ Auto-Generate Timetable'}
        </Btn>
        <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className={`${inp} w-48`}>
          <option value="">— View a class —</option>
          {Object.keys(byForm).sort((a,b)=>Number(a)-Number(b)).map(form=>(
            <optgroup key={form} label={`Form ${form}`}>
              {byForm[form].map(c=><option key={c.key} value={c.key}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
        {clashes.size>0 && (
          <span className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded px-2 py-1">
            ⚠ {clashes.size} teacher clash{clashes.size>1?'es':''}
          </span>
        )}
        {!clashes.size && Object.keys(timetable).length>0 && (
          <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">✓ No clashes</span>
        )}
        {selectedClass && (
          <Btn variant="ghost" className="ml-auto"
            onClick={()=>downloadClassPDF(
              classes.find(c=>c.key===selectedClass)?.name || selectedClass,
              classTt, allPeriods, config, periodMap
            )}>
            ⬇ Download PDF
          </Btn>
        )}
      </div>

      {unplaced.length>0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-semibold text-amber-800 text-sm mb-1">⚠ {unplaced.length} lesson{unplaced.length>1?'s':''} could not be placed</p>
          <ul className="text-xs text-amber-700 space-y-0.5 mb-2">
            {unplaced.map((l,i)=><li key={i}>• {l.subjectName} → {l.classKey} ({l.teacherName})</li>)}
          </ul>
          <p className="text-xs text-amber-600">Reduce periods/week or add more teachers to resolve.</p>
        </div>
      )}

      {!selectedClass && <p className="text-sm text-slate-400">{Object.keys(timetable).length ? 'Select a class to view its timetable.' : 'Click Auto-Generate after setting up assignments.'}</p>}

      {selectedClass && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#0D3B66] text-white">
                <th className="p-2 text-left font-medium w-28 sticky left-0 bg-[#0D3B66]">Period</th>
                {DAYS.map(day=>(
                  <th key={day} className="p-2 text-center font-medium min-w-[120px]">{DAY_LABEL[day]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buildGridRows(allPeriods, config, periodMap, classTt, clashes, selectedClass)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function buildGridRows(allPeriods, config, periodMap, classTt, clashes, classKey) {
  const rows = []
  const breaks = [...(config.breaks||[])].sort((a,b)=>a.startTime.localeCompare(b.startTime))

  for (const period of allPeriods) {
    // Insert break rows before this period if a break falls in the right spot
    for (const brk of breaks) {
      const brkKey = `brk_${brk.id}_before_p${period}`
      const precedingPeriod = allPeriods[allPeriods.indexOf(period)-1]

      if (!precedingPeriod) continue
      // Check if break fits between previous period end and this period start
      const mondayType = config.weekSchedule?.monday||'fullDay'
      const prevEnd  = (periodMap[mondayType]||[]).find(p=>p.period===precedingPeriod)?.end
      const thisStart = (periodMap[mondayType]||[]).find(p=>p.period===period)?.start

      if (prevEnd && thisStart && brk.startTime>=prevEnd && brk.endTime<=thisStart) {
        rows.push(
          <tr key={brkKey} className="bg-slate-100">
            <td colSpan={6} className="px-3 py-1 text-xs text-slate-500 italic">
              ☕ <strong>{brk.label}</strong>  {brk.startTime} – {brk.endTime}
            </td>
          </tr>
        )
      }
    }

    rows.push(
      <tr key={period} className="border-b border-slate-100 hover:bg-slate-50">
        <td className="p-2 text-xs text-slate-500 font-medium sticky left-0 bg-white">
          <div className="font-semibold">Period {period}</div>
          {(() => {
            const dt = config.weekSchedule?.monday||'fullDay'
            const t  = (periodMap[dt]||[]).find(p=>p.period===period)
            return t ? <div className="text-slate-400">{t.start}–{t.end}</div> : null
          })()}
        </td>
        {DAYS.map(day=>{
          const dt       = config.weekSchedule?.[day]||'fullDay'
          const dayConf  = config.dayTypes?.[dt]
          const periods  = (periodMap[dt]||[]).map(p=>p.period)
          const slot     = classTt[day]?.[period]
          const clashKey = slot?.teacherUid ? `${slot.teacherUid}|${day}|${period}` : null
          const isClash  = clashKey && clashes.has(clashKey)

          if (dayConf?.noLessons) {
            return (
              <td key={day} className="p-1 bg-slate-50">
                {period===allPeriods[0] && (
                  <div className="h-10 flex items-center justify-center text-xs text-slate-400 italic">{dayConf.label}</div>
                )}
              </td>
            )
          }
          if (!periods.includes(period)) return <td key={day} className="p-1 bg-slate-50" />

          return (
            <td key={day} className={`p-1 ${isClash?'bg-red-50':''}`}>
              {slot ? (
                <div className={`rounded border p-1.5 text-xs ${subjectColour(slot.subjectKey)} ${isClash?'border-red-400 ring-1 ring-red-400':''}`}>
                  <div className="font-semibold leading-tight">{slot.subjectName}</div>
                  <div className="opacity-70 text-xs leading-tight truncate">{slot.teacherName}</div>
                  {isClash && <div className="text-red-600 font-bold text-xs mt-0.5">⚠ CLASH</div>}
                </div>
              ) : (
                <div className="h-10 rounded border border-dashed border-slate-200 flex items-center justify-center">
                  <span className="text-slate-300 text-xs">free</span>
                </div>
              )}
            </td>
          )
        })}
      </tr>
    )
  }
  return rows
}

// ── Tab 4: Teacher View ───────────────────────────────────────────────────────

function TeacherViewTab({ timetable, teachers, config, classes }) {
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const clashes    = detectClashes(timetable)
  const periodMap  = computePeriodTimes(config)

  const myGrid = {}
  if (selectedTeacher) {
    for (const [classKey, days] of Object.entries(timetable)) {
      const cls = classes.find(c=>c.key===classKey)
      for (const [day, periods] of Object.entries(days)) {
        for (const [period, slot] of Object.entries(periods)) {
          if (slot?.teacherUid===selectedTeacher) {
            if (!myGrid[day]) myGrid[day]={}
            myGrid[day][period] = { ...slot, classKey, className: cls?.name||classKey }
          }
        }
      }
    }
  }

  const allPeriods = [...new Set(
    DAYS.flatMap(day=>{
      const dt=config.weekSchedule?.[day]||'fullDay'
      return (periodMap[dt]||[]).map(p=>p.period)
    })
  )].sort((a,b)=>a-b)

  const teacher    = teachers.find(t=>t.uid===selectedTeacher)
  const totalPds   = Object.values(myGrid).reduce((s,d)=>s+Object.keys(d).length,0)

  // Also show class teacher roles
  const classTeacherOf = classes.filter(c=>c.teacherUid===selectedTeacher)

  return (
    <div className="space-y-4 max-w-5xl">
      <select value={selectedTeacher} onChange={e=>setSelectedTeacher(e.target.value)} className={`${inp} w-64`}>
        <option value="">— Select a teacher —</option>
        {teachers.map(t=><option key={t.uid} value={t.uid}>{t.displayName||t.email}</option>)}
      </select>

      {!selectedTeacher && <p className="text-sm text-slate-400">Select a teacher to see their complete schedule.</p>}

      {selectedTeacher && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="font-semibold text-slate-700 text-lg">{teacher?.displayName||teacher?.email}</h2>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">{totalPds} periods/week</span>
            {classTeacherOf.length>0 && (
              <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                🏫 Class Teacher of: {classTeacherOf.map(c=>c.name).join(', ')}
              </span>
            )}
            <Btn variant="ghost" className="ml-auto"
              onClick={()=>downloadTeacherPDF(
                teacher?.displayName||teacher?.email||selectedTeacher,
                myGrid, allPeriods, config, periodMap, classes
              )}>
              ⬇ Download PDF
            </Btn>
          </div>

          {totalPds===0 ? (
            <p className="text-sm text-slate-400">No lessons assigned. Generate the timetable first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#0D3B66] text-white">
                    <th className="p-2 text-left font-medium w-28">Period</th>
                    {DAYS.map(day=><th key={day} className="p-2 text-center font-medium min-w-[110px]">{DAY_LABEL[day]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {allPeriods.map(period=>{
                    const mondayDt  = config.weekSchedule?.monday||'fullDay'
                    const mondayTimes = (periodMap[mondayDt]||[]).find(p=>p.period===period)
                    return (
                      <tr key={period} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2 text-xs text-slate-500">
                          <div className="font-medium">Period {period}</div>
                          {mondayTimes && <div className="text-slate-400">{mondayTimes.start}</div>}
                        </td>
                        {DAYS.map(day=>{
                          const dt      = config.weekSchedule?.[day]||'fullDay'
                          const dtConf  = config.dayTypes?.[dt]
                          const periods = (periodMap[dt]||[]).map(p=>p.period)
                          const slot    = myGrid[day]?.[period]
                          const ck      = slot ? `${selectedTeacher}|${day}|${period}` : null
                          const isClash = ck && clashes.has(ck)

                          if (dtConf?.noLessons) return <td key={day} className="p-1 bg-slate-50" />
                          if (!periods.includes(period)) return <td key={day} className="p-1 bg-slate-50" />

                          return (
                            <td key={day} className={`p-1 ${isClash?'bg-red-50':''}`}>
                              {slot ? (
                                <div className={`rounded border p-1.5 text-xs ${subjectColour(slot.subjectKey)} ${isClash?'border-red-400 ring-1 ring-red-400':''}`}>
                                  <div className="font-semibold">{slot.subjectName}</div>
                                  <div className="opacity-70 text-xs">{slot.className}</div>
                                  {isClash && <div className="text-red-600 font-bold text-xs">⚠ CLASH</div>}
                                </div>
                              ) : (
                                <div className="h-10 rounded border border-dashed border-slate-100 flex items-center justify-center">
                                  <span className="text-slate-200 text-xs">—</span>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
