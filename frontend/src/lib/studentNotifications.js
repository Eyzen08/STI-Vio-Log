export const notificationLabel = (value) => String(value || 'GENERAL').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())

export const notificationSummary = (items = []) => ({ total: items.length, unread: items.filter((item) => !item.is_read).length })

export const notificationDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}
