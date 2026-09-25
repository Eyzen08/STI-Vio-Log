import { formatDisplayLabel, formatManilaDateTime } from './displayFormat.js'

export const notificationLabel = (value) => formatDisplayLabel(value || 'GENERAL')

export const notificationSummary = (items = []) => ({ total: items.length, unread: items.filter((item) => !item.is_read).length })

export const notificationDate = (value) => {
  return formatManilaDateTime(value, 'Date unavailable')
}
