const ACCEPTED_SIGNATURE_TYPES = ['image/png', 'image/jpeg']
const MAX_SIGNATURE_BYTES = 1024 * 1024

function validateSignatureFile(file) {
  if (!file) return 'Choose a PNG or JPEG signature image.'
  if (!ACCEPTED_SIGNATURE_TYPES.includes(file.type)) return 'Signature image must be a PNG or JPEG file.'
  if (file.size > MAX_SIGNATURE_BYTES) return 'Signature image must be 1 MB or smaller.'
  return ''
}

function readSignatureFile(file) {
  return new Promise((resolve, reject) => {
    const validationError = validateSignatureFile(file)
    if (validationError) return reject(new Error(validationError))
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The signature image could not be read.'))
    reader.readAsDataURL(file)
  })
}

function readableOfficerName(value) {
  const text = String(value || '').trim()
  if (!text || text !== text.toUpperCase()) return text
  return text.toLocaleLowerCase('en-PH').replace(/(^|[\s'-])\p{L}/gu, (match) => match.toLocaleUpperCase('en-PH'))
}

export { ACCEPTED_SIGNATURE_TYPES, MAX_SIGNATURE_BYTES, readableOfficerName, readSignatureFile, validateSignatureFile }
