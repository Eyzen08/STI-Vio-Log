export const getStudentQrPayload = (profile) => {
  const value = profile?.qr_code
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export const qrDownloadName = (studentNumber) => {
  const safeNumber = String(studentNumber || 'student').replace(/[^a-z0-9_-]/gi, '') || 'student'
  return `sti-vio-log-${safeNumber}-qr.png`
}

export const renderStudentQr = async (payload, logoUrl) => {
  const { default: QRCode } = await import('qrcode')
  const logo = new Image()
  logo.src = logoUrl
  await logo.decode()

  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, payload, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: 720,
    color: { dark: '#122033', light: '#ffffff' }
  })

  const canvas = document.createElement('canvas')
  canvas.width = 816
  canvas.height = 1024
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#122033'
  context.lineWidth = 4
  context.strokeRect(2, 2, 812, 1020)
  context.fillStyle = '#ffcf24'
  context.fillRect(0, 0, 816, 12)
  context.fillRect(0, 1012, 816, 12)
  context.fillRect(0, 0, 12, 1024)
  context.fillRect(804, 0, 12, 1024)
  context.drawImage(logo, 260, 24, 296, 296 * logo.naturalHeight / logo.naturalWidth)
  // Keep all branding outside the QR canvas, including its four-module quiet zone.
  context.drawImage(qr, 48, 208)
  context.fillStyle = '#122033'
  context.font = '600 26px Arial, sans-serif'
  context.textAlign = 'center'
  context.fillText('COMMUNITY-SERVICE ATTENDANCE', 408, 979)

  return canvas.toDataURL('image/png')
}
