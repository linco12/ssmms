import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PRIMARY = '#0D3B66'

export function generateReceipt(student, payment, balance) {
  const doc = new jsPDF()

  doc.setFillColor(PRIMARY)
  doc.rect(0, 0, 210, 40, 'F')
  doc.setTextColor('#ffffff')
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('TronicVolt Autonetics Investments', 105, 15, { align: 'center' })
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('SSMMS — Smart School Management System', 105, 24, { align: 'center' })
  doc.text('PAYMENT RECEIPT', 105, 34, { align: 'center' })

  doc.setTextColor('#000000')
  doc.setFontSize(10)

  const receiptNo = payment.id?.slice(0, 8).toUpperCase() || 'N/A'
  const date = payment.date
    ? new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  doc.setFont('helvetica', 'bold')
  doc.text(`Receipt No: ${receiptNo}`, 14, 52)
  doc.setFont('helvetica', 'normal')
  doc.text(`Date: ${date}`, 150, 52)

  autoTable(doc, {
    startY: 60,
    head: [['Field', 'Details']],
    body: [
      ['Student Name', student.fullName || '—'],
      ['Student ID', student.studentId || '—'],
      ['Class / Grade', student.classGrade || '—'],
      ['Guardian', student.guardianName || '—'],
      ['Payment Type', payment.paymentType || 'Fee Payment'],
      ['Amount Paid', `$${Number(payment.amount).toFixed(2)}`],
      ['Balance Remaining', `$${Number(balance).toFixed(2)}`],
      ['Recorded By', payment.recordedBy || '—'],
    ],
    headStyles: { fillColor: PRIMARY },
    alternateRowStyles: { fillColor: '#f0f4f8' },
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
  })

  const finalY = doc.lastAutoTable.finalY + 20
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor('#666666')
  doc.text('This is a computer-generated receipt. No signature required.', 105, finalY, { align: 'center' })
  doc.text('TronicVolt Autonetics Investments — SSMMS', 105, finalY + 6, { align: 'center' })

  return doc
}

export function generatePaymentHistory(studentName, studentId, classGrade, payments) {
  const doc = new jsPDF()

  doc.setFillColor(PRIMARY)
  doc.rect(0, 0, 210, 40, 'F')
  doc.setTextColor('#ffffff')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('TronicVolt Autonetics Investments', 105, 14, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('SSMMS — Payment History Report', 105, 23, { align: 'center' })
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 32, { align: 'center' })

  doc.setTextColor('#000000')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Student:', 14, 52)
  doc.setFont('helvetica', 'normal')
  doc.text(studentName || '—', 40, 52)
  doc.setFont('helvetica', 'bold')
  doc.text('ID:', 110, 52)
  doc.setFont('helvetica', 'normal')
  doc.text(studentId || '—', 120, 52)
  doc.setFont('helvetica', 'bold')
  doc.text('Class:', 14, 59)
  doc.setFont('helvetica', 'normal')
  doc.text(classGrade || '—', 40, 59)

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Paid:', 110, 59)
  doc.setFont('helvetica', 'normal')
  doc.text(`$${total.toFixed(2)}`, 138, 59)

  autoTable(doc, {
    startY: 66,
    head: [['Date', 'Payment Type', 'Amount', 'Notes', 'Recorded By']],
    body: payments
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(p => [
        p.date ? new Date(p.date).toLocaleDateString('en-GB') : '—',
        p.paymentType || '—',
        `$${Number(p.amount || 0).toFixed(2)}`,
        p.notes || '—',
        p.recordedBy || '—',
      ]),
    headStyles: { fillColor: PRIMARY },
    alternateRowStyles: { fillColor: '#f0f4f8' },
    styles: { fontSize: 9 },
    foot: [['', 'TOTAL', `$${total.toFixed(2)}`, '', '']],
    footStyles: { fillColor: '#e8edf2', fontStyle: 'bold', fontSize: 9 },
  })

  const finalY = doc.lastAutoTable.finalY + 14
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor('#888888')
  doc.text('This is a computer-generated report. TronicVolt Autonetics Investments — SSMMS', 105, finalY, { align: 'center' })

  return doc
}

export function generateFeeReport(rows, title) {
  const doc = new jsPDF()

  doc.setFillColor(PRIMARY)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor('#ffffff')
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('SSMMS — ' + title, 105, 20, { align: 'center' })

  doc.setTextColor('#000000')
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38)

  autoTable(doc, {
    startY: 44,
    head: [Object.keys(rows[0] || {})],
    body: rows.map(Object.values),
    headStyles: { fillColor: PRIMARY },
    alternateRowStyles: { fillColor: '#f0f4f8' },
    styles: { fontSize: 8 },
  })

  return doc
}
