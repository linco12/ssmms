import { useEffect, useState } from 'react'
import { db, storage } from '../../firebase/config'
import { ref, onValue, push, update, serverTimestamp } from 'firebase/database'
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../context/AuthContext'
import { logAction } from '../../utils/auditLogger'
import { generateReceipt } from '../../utils/pdfGenerator'
import { createNotification } from '../../services/notificationService'
import FeatureGate from '../../components/FeatureGate'
import { getFlag } from '../../utils/featureFlags'

export default function RecordPaymentPage() {
  const { currentUser } = useAuth()
  const [students, setStudents] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentType, setPaymentType] = useState('School Fees')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    return onValue(ref(db, 'students'), (snap) => {
      const list = []
      snap.forEach((c) => { list.push({ key: c.key, ...c.val() }) })
      setStudents(list)
    })
  }, [])

  const student = students.find((s) => s.key === selectedKey)
  const newBalance = student ? Math.max(0, Number(student.feeBalance || 0) - Number(amount || 0)) : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!student || !amount) return
    setSaving(true)
    try {
      const paymentData = {
        studentKey: selectedKey,
        studentId: student.studentId,
        studentName: student.fullName,
        amount: Number(amount),
        paymentType,
        notes,
        recordedBy: currentUser?.email || 'unknown',
        date: new Date().toISOString(),
        timestamp: serverTimestamp(),
      }

      const payRef = push(ref(db, `payments/${selectedKey}`))
      await payRef
      const payId = payRef.key
      paymentData.id = payId
      await push(ref(db, `payments/${selectedKey}`), paymentData)

      await update(ref(db, `students/${selectedKey}`), { feeBalance: newBalance })

      await logAction(currentUser, 'PAYMENT', 'fee', {
        studentId: student.studentId,
        amount: Number(amount),
        newBalance,
      })

      let receiptUrl = null
      if (getFlag('receiptGeneration')) {
        try {
          const doc = generateReceipt(student, { ...paymentData, id: payId }, newBalance)
          const pdfDataUri = doc.output('datauristring')
          const fileRef = storageRef(storage, `receipts/${selectedKey}/${payId}.pdf`)
          await uploadString(fileRef, pdfDataUri, 'data_url')
          receiptUrl = await getDownloadURL(fileRef)
        } catch (err) {
          console.warn('Receipt storage upload failed (check Firebase Storage config):', err)
        }
      }

      if (student.linkedParentUid) {
        await createNotification(student.linkedParentUid, {
          title: 'Payment Received',
          body: `$${Number(amount).toFixed(2)} payment recorded for ${student.fullName}. Balance: $${newBalance.toFixed(2)}`,
          type: 'payment',
        })
      }

      setSuccess({ paymentData: { ...paymentData, id: payId }, receiptUrl })
      setAmount('')
      setNotes('')
    } finally {
      setSaving(false)
    }
  }

  const downloadReceipt = () => {
    if (!success) return
    const doc = generateReceipt(student || {}, success.paymentData, newBalance)
    doc.save(`Receipt_${success.paymentData.studentId}_${Date.now()}.pdf`)
  }

  const printReceipt = () => {
    if (!success) return
    const doc = generateReceipt(student || {}, success.paymentData, newBalance)
    doc.autoPrint()
    window.open(doc.output('bloburl'), '_blank')
  }

  return (
    <FeatureGate flag="feeManagement">
      <div className="max-w-xl">
        <h2 className="text-xl font-bold text-[#0D3B66] mb-4">Record Payment</h2>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
            <p className="text-emerald-700 font-semibold text-sm">Payment recorded successfully!</p>
            <p className="text-emerald-600 text-xs mt-1">New balance: ${newBalance.toFixed(2)}</p>
            <FeatureGate flag="receiptGeneration">
              <div className="flex gap-2 mt-3">
                <button
                  onClick={printReceipt}
                  className="text-xs bg-[#0D3B66] text-white px-3 py-1.5 rounded hover:bg-[#0a2f52]"
                >
                  Print Receipt
                </button>
                <button
                  onClick={downloadReceipt}
                  className="text-xs border border-[#0D3B66] text-[#0D3B66] px-3 py-1.5 rounded hover:bg-slate-50"
                >
                  Download PDF
                </button>
              </div>
            </FeatureGate>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Student</label>
            <select
              value={selectedKey}
              onChange={(e) => { setSelectedKey(e.target.value); setSuccess(null) }}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
            >
              <option value="">— Select student —</option>
              {students.map((s) => (
                <option key={s.key} value={s.key}>{s.fullName} ({s.studentId})</option>
              ))}
            </select>
          </div>

          {student && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p><span className="text-slate-400">Class:</span> {student.classGrade}</p>
              <p><span className="text-slate-400">Current Balance:</span> <span className={Number(student.feeBalance) > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>${Number(student.feeBalance || 0).toFixed(2)}</span></p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Type</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
            >
              {['School Fees', 'Exam Fees', 'Uniform', 'Sports', 'Books', 'Other'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66] resize-none"
            />
          </div>

          {student && amount && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p>New balance after payment: <span className="font-semibold">${newBalance.toFixed(2)}</span></p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !selectedKey || !amount}
            className="w-full bg-[#0D3B66] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60 transition-colors"
          >
            {saving ? 'Recording…' : 'Record Payment'}
          </button>
        </form>
      </div>
    </FeatureGate>
  )
}
