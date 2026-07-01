// Feature flags control UI visibility for all users via Firebase RTDB.
// They NEVER gate real security — Firebase Auth + Security Rules enforce all access control.
// The developer (isDeveloper: true) always sees every feature regardless of flags.

export const DEFAULTS = {
  // ── Teacher privileges (per-user overrides via userPrivileges node) ────────
  priv_teacher_add_students: false,
  // ── Feature modules ───────────────────────────────────────────────────────
  feeManagement:       true,
  receiptGeneration:   true,
  enrollmentTracking:  true,
  notificationsEngine: true,
  reportsAnalytics:    true,
  auditTrail:          true,
  academicRecords:     true,
  offlineMode:         true,
  whatsappSimulator:   true,
  parentBroadcast:     true,
  // ── Admin navigation tabs ─────────────────────────────────────────────────
  nav_admin_students:    true,
  nav_admin_classes:     true,
  nav_admin_promote:     true,
  nav_admin_fees:        true,
  nav_admin_enrollment:  true,
  nav_admin_calendar:    true,
  nav_admin_timetable:   true,
  nav_admin_news:        true,
  nav_admin_gallery:     true,
  nav_admin_subjects:    true,
  nav_admin_assessments: true,
  nav_admin_reports:     true,
  nav_admin_audit:       true,
  nav_admin_broadcast:   true,
  nav_admin_users:       true,
  // ── Teacher navigation tabs ───────────────────────────────────────────────
  nav_teacher_results:     true,
  nav_teacher_attendance:  true,
  nav_teacher_assignments: true,
  nav_teacher_timetable:   true,
  nav_teacher_calendar:    true,
  nav_teacher_notify:      true,
  // ── Parent navigation tabs ────────────────────────────────────────────────
  nav_parent_results:       true,
  nav_parent_fees:          true,
  nav_parent_news:          true,
  nav_parent_gallery:       true,
  nav_parent_notifications: true,
  nav_parent_calendar:      true,
  nav_parent_whatsapp:      true,
  // ── Student navigation tabs ───────────────────────────────────────────────
  nav_student_results:       true,
  nav_student_fees:          true,
  nav_student_assignments:   true,
  nav_student_timetable:     true,
  nav_student_calendar:      true,
  nav_student_news:          true,
  nav_student_gallery:       true,
  nav_student_notifications: true,
}

export const FLAG_META = {
  // ── Teacher privileges ────────────────────────────────────────────────────
  priv_teacher_add_students: { label: 'Add Students to Class', desc: 'Teacher can create student profiles for their assigned class', group: 'Teacher Privileges' },
  // ── Features ──────────────────────────────────────────────────────────────
  feeManagement:       { label: 'Fee Management',       desc: 'Fee recording & balance tracking',                     group: 'Features' },
  receiptGeneration:   { label: 'Receipt Generation',   desc: 'Automatic PDF receipts after payment',                 group: 'Features' },
  enrollmentTracking:  { label: 'Enrollment Tracking',  desc: 'Active / Suspended / Withdrawn status management',     group: 'Features' },
  notificationsEngine: { label: 'Notifications Engine', desc: 'Push notifications & alerts via Firebase',             group: 'Features' },
  reportsAnalytics:    { label: 'Reports & Analytics',  desc: 'Fee collection summaries and enrollment reports',      group: 'Features' },
  auditTrail:          { label: 'Audit Trail',           desc: 'Log and view all create / update / delete actions',   group: 'Features' },
  academicRecords:     { label: 'Academic Records',     desc: 'Teacher results / grades entry module',                group: 'Features' },
  offlineMode:         { label: 'Offline Mode',         desc: 'Offline persistence banner & sync indicator',          group: 'Features' },
  whatsappSimulator:   { label: 'WhatsApp Simulator',   desc: 'Internal debug tool for simulating WhatsApp queries',  group: 'Features' },
  parentBroadcast:     { label: 'Parent Broadcast',     desc: 'Admin broadcast announcement tool for all parents',    group: 'Features' },
  // ── Admin nav ─────────────────────────────────────────────────────────────
  nav_admin_students:    { label: 'Students',     desc: 'Admin → Students page',     group: 'Admin Navigation' },
  nav_admin_classes:     { label: 'Classes',      desc: 'Admin → Classes page',      group: 'Admin Navigation' },
  nav_admin_promote:     { label: 'Promote',      desc: 'Admin → Promote page',      group: 'Admin Navigation' },
  nav_admin_fees:        { label: 'Fees',         desc: 'Admin → Fees page',         group: 'Admin Navigation' },
  nav_admin_enrollment:  { label: 'Enrollment',   desc: 'Admin → Enrollment page',   group: 'Admin Navigation' },
  nav_admin_calendar:    { label: 'Calendar',     desc: 'Admin → Calendar page',     group: 'Admin Navigation' },
  nav_admin_timetable:   { label: 'Timetable',    desc: 'Admin → Timetable page',    group: 'Admin Navigation' },
  nav_admin_news:        { label: 'News',         desc: 'Admin → News page',         group: 'Admin Navigation' },
  nav_admin_gallery:     { label: 'Gallery',      desc: 'Admin → Gallery page',      group: 'Admin Navigation' },
  nav_admin_subjects:    { label: 'Subjects',     desc: 'Admin → Subjects page',     group: 'Admin Navigation' },
  nav_admin_assessments: { label: 'Assessments',  desc: 'Admin → Assessments page',  group: 'Admin Navigation' },
  nav_admin_reports:     { label: 'Reports',      desc: 'Admin → Reports page',      group: 'Admin Navigation' },
  nav_admin_audit:       { label: 'Audit Log',    desc: 'Admin → Audit Log page',    group: 'Admin Navigation' },
  nav_admin_broadcast:   { label: 'Broadcast',    desc: 'Admin → Broadcast page',    group: 'Admin Navigation' },
  nav_admin_users:       { label: 'Users',        desc: 'Admin → Users page',        group: 'Admin Navigation' },
  // ── Teacher nav ───────────────────────────────────────────────────────────
  nav_teacher_results:     { label: 'Results & Grades', desc: 'Teacher → Results page',     group: 'Teacher Navigation' },
  nav_teacher_attendance:  { label: 'Attendance',       desc: 'Teacher → Attendance page',  group: 'Teacher Navigation' },
  nav_teacher_assignments: { label: 'Assignments',      desc: 'Teacher → Assignments page', group: 'Teacher Navigation' },
  nav_teacher_timetable:   { label: 'Timetable',        desc: 'Teacher → Timetable page',   group: 'Teacher Navigation' },
  nav_teacher_calendar:    { label: 'Calendar',         desc: 'Teacher → Calendar page',    group: 'Teacher Navigation' },
  nav_teacher_notify:      { label: 'Notify',           desc: 'Teacher → Send notification to class or student', group: 'Teacher Navigation' },
  // ── Parent nav ────────────────────────────────────────────────────────────
  nav_parent_results:       { label: 'Results',       desc: 'Parent → Results page',       group: 'Parent Navigation' },
  nav_parent_fees:          { label: 'Fees',          desc: 'Parent → Fees page',          group: 'Parent Navigation' },
  nav_parent_news:          { label: 'News',          desc: 'Parent → News page',          group: 'Parent Navigation' },
  nav_parent_gallery:       { label: 'Gallery',       desc: 'Parent → Gallery page',       group: 'Parent Navigation' },
  nav_parent_notifications: { label: 'Notifications', desc: 'Parent → Notifications page', group: 'Parent Navigation' },
  nav_parent_calendar:      { label: 'Calendar',      desc: 'Parent → Calendar page',      group: 'Parent Navigation' },
  nav_parent_whatsapp:      { label: 'WA Simulator',  desc: 'Parent → WhatsApp Sim page',  group: 'Parent Navigation' },
  // ── Student nav ───────────────────────────────────────────────────────────
  nav_student_results:       { label: 'My Results',      desc: 'Student → Results page',       group: 'Student Navigation' },
  nav_student_fees:          { label: 'My Fees',         desc: 'Student → Fees page',          group: 'Student Navigation' },
  nav_student_assignments:   { label: 'Assignments',     desc: 'Student → Assignments page',   group: 'Student Navigation' },
  nav_student_timetable:     { label: 'Timetable',       desc: 'Student → Timetable page',     group: 'Student Navigation' },
  nav_student_calendar:      { label: 'Calendar',        desc: 'Student → Calendar page',      group: 'Student Navigation' },
  nav_student_news:          { label: 'News',            desc: 'Student → News page',          group: 'Student Navigation' },
  nav_student_gallery:       { label: 'Gallery',         desc: 'Student → Gallery page',       group: 'Student Navigation' },
  nav_student_notifications: { label: 'Notifications',   desc: 'Student → Notifications page', group: 'Student Navigation' },
}

// Legacy exports — kept so existing callers don't break.
// Real flag checks now go through FeatureFlagsContext (Firebase-backed).
export const FLAG_LABELS = FLAG_META
export const getFlag     = (name) => DEFAULTS[name] ?? true
export const setFlag     = () => {}
export const getAllFlags  = () => ({ ...DEFAULTS })
export const resetFlags  = () => {}
