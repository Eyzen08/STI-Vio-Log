import { API_URL, apiRequest } from './api.js'

export const AVATAR_PRESETS = Array.from({ length: 48 }, (_, index) => ({
  id: `portrait-${String(index + 1).padStart(2, '0')}`,
  label: `Portrait ${index + 1}${index >= 24 ? ' with glasses' : ''}`
}))
export const avatarImageUrl = (avatar) => {
  if (avatar?.source === 'PRESET' && AVATAR_PRESETS.some((preset) => preset.id === avatar.preset_id)) return `/avatars/${avatar.preset_id}.svg`
  if (avatar?.source === 'PHOTO' && /^\/api\/avatars\/\d+\/photo\?v=[0-9a-f-]{36}$/i.test(avatar.photo_url || '')) return `${API_URL}${avatar.photo_url}`
  return ''
}
export const getAvatar = () => apiRequest('/api/account/avatar')
export const saveAvatar = (selection) => apiRequest('/api/account/avatar', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selection)
})
export const changeStudentPhoto = (studentId, { image, reason, remove = false }) => apiRequest(`/api/students/${studentId}/avatar`, {
  method: remove ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(remove ? { reason } : { image_data_url: image, reason })
})

export const prepareAvatarPhoto = async (file) => {
  if (!file || !['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Choose a JPEG or PNG image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image of 5 MB or smaller.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode().catch(() => { throw new Error('This image could not be read. Choose another JPEG or PNG.') })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const context = canvas.getContext('2d')
    if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error('This image could not be read.')
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 512, 512)
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512)
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally { URL.revokeObjectURL(url) }
}
