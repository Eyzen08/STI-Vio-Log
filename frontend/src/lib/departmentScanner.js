export const normalizeQrValue = (value) => typeof value === 'string' ? value.trim() : ''

export const isVerifiedQr = (enteredValue, verifiedValue) => {
  const entered = normalizeQrValue(enteredValue)
  const verified = normalizeQrValue(verifiedValue)
  return Boolean(entered && verified && entered === verified)
}

export const scannerQrBox = (viewfinderWidth, viewfinderHeight) => {
  const shortestSide = Math.max(0, Math.min(Number(viewfinderWidth) || 0, Number(viewfinderHeight) || 0))
  const size = Math.max(160, Math.min(280, Math.floor(shortestSide * 0.72)))
  return { width: size, height: size }
}

export const cameraUnavailableMessage = ({ secureContext, hasMediaDevices }) => {
  if (!secureContext) return 'Camera scanning requires HTTPS or localhost.'
  if (!hasMediaDevices) return 'Camera scanning is not supported by this browser. Enter the QR code manually.'
  return ''
}

export const assignmentProgress = (assignment) => {
  const required = Math.max(0, Number(assignment?.required_hours) || 0)
  const completed = Math.max(0, Number(assignment?.completed_hours) || 0)
  const remaining = Math.max(0, Number(assignment?.remaining_hours) || 0)
  return { required, completed, remaining }
}
