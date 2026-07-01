// WhatsApp Service — placeholder for WhatsApp Business API / Twilio integration.
// Replace the bodies of these functions with real API calls when credentials are available.
// The rest of the app does NOT require a live WhatsApp key to run.

import { db } from '../firebase/config'
import { ref, get, query, orderByChild, equalTo } from 'firebase/database'

// --- OUTBOUND ---

/**
 * Send a WhatsApp message to a phone number.
 * @param {string} to - E.164 phone number e.g. "+263771234567"
 * @param {string} body - Message text
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendWhatsAppMessage(to, body) {
  // TODO: Replace with WhatsApp Business API or Twilio call
  console.log('[WhatsApp STUB] sendWhatsAppMessage', { to, body })
  return { success: true, messageId: 'stub-' + Date.now() }
}

/**
 * Send a fee-due reminder to a parent.
 */
export async function sendFeeReminder(parentPhone, studentName, amountDue) {
  const body =
    `SSMMS Alert: Dear Parent, the fee balance of $${amountDue} ` +
    `for ${studentName} is now overdue. Please make payment as soon as possible.`
  return sendWhatsAppMessage(parentPhone, body)
}

/**
 * Send a payment confirmation to a parent.
 */
export async function sendPaymentConfirmation(parentPhone, studentName, amount, balance) {
  const body =
    `SSMMS Receipt: Payment of $${amount} received for ${studentName}. ` +
    `Remaining balance: $${balance}. Thank you!`
  return sendWhatsAppMessage(parentPhone, body)
}

// --- INBOUND QUERY HANDLER ---

/**
 * Process an incoming WhatsApp query and return a reply string.
 * Supports: "balance for <studentID>", "results for <studentID>", "status for <studentID>"
 * @param {string} messageText - Raw message from parent
 * @returns {Promise<string>} - Reply text
 */
export async function handleIncomingWhatsAppQuery(messageText) {
  const text = (messageText || '').trim().toLowerCase()

  // Match "balance for ABC123"
  const balanceMatch = text.match(/balance\s+for\s+([a-z0-9-]+)/i)
  if (balanceMatch) {
    const studentId = balanceMatch[1].toUpperCase()
    return await getBalanceReply(studentId)
  }

  // Match "results for ABC123"
  const resultsMatch = text.match(/results\s+for\s+([a-z0-9-]+)/i)
  if (resultsMatch) {
    const studentId = resultsMatch[1].toUpperCase()
    return await getResultsReply(studentId)
  }

  // Match "status for ABC123"
  const statusMatch = text.match(/status\s+for\s+([a-z0-9-]+)/i)
  if (statusMatch) {
    const studentId = statusMatch[1].toUpperCase()
    return await getStatusReply(studentId)
  }

  return (
    'Welcome to SSMMS (TronicVolt Autonetics). I can help with:\n' +
    '• "balance for <studentID>" — fee balance\n' +
    '• "results for <studentID>" — latest results\n' +
    '• "status for <studentID>" — enrollment status\n' +
    'Please reply with one of the above commands.'
  )
}

async function findStudentById(studentId) {
  const snap = await get(query(ref(db, 'ssmms/students'), orderByChild('studentId'), equalTo(studentId)))
  if (!snap.exists()) return null
  const entries = Object.entries(snap.val())
  return { key: entries[0][0], ...entries[0][1] }
}

async function getBalanceReply(studentId) {
  const student = await findStudentById(studentId)
  if (!student) return `No student found with ID ${studentId}. Please check and try again.`
  const balance = student.feeBalance ?? 0
  return `Fee balance for ${student.fullName} (${studentId}): $${Number(balance).toFixed(2)}`
}

async function getResultsReply(studentId) {
  const student = await findStudentById(studentId)
  if (!student) return `No student found with ID ${studentId}.`
  const resultsSnap = await get(ref(db, `ssmms/academicResults/${student.key}`))
  if (!resultsSnap.exists()) return `No academic results found yet for ${student.fullName}.`
  const results = resultsSnap.val()
  const lines = Object.entries(results)
    .slice(0, 5)
    .map(([subject, data]) => `  ${subject}: ${data.grade || data.score || '—'}`)
    .join('\n')
  return `Latest results for ${student.fullName}:\n${lines}`
}

async function getStatusReply(studentId) {
  const student = await findStudentById(studentId)
  if (!student) return `No student found with ID ${studentId}.`
  return `Enrollment status for ${student.fullName}: ${student.enrollmentStatus || 'Active'}`
}
