export const unreadMessageCount = (conversations = []) =>
  (Array.isArray(conversations) ? conversations : []).reduce((total, conversation) => {
    const count = Number(conversation?.unread_count)
    return total + (Number.isInteger(count) && count > 0 ? count : 0)
  }, 0)

export const formatUnreadMessageCount = (count) => {
  const value = Math.max(0, Number(count) || 0)
  if (!value) return ''
  return value > 99 ? '99+' : String(Math.floor(value))
}
