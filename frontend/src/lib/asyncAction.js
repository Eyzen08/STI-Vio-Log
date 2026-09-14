import { useCallback, useRef } from 'react'

export const formatActionCount = (count) => {
  const value = Math.max(0, Math.floor(Number(count) || 0))
  if (!value) return ''
  return value > 99 ? '99+' : String(value)
}

export const createActionLock = () => {
  const active = new Set()

  return async (key, action) => {
    if (active.has(key)) return undefined
    active.add(key)
    try {
      return await action()
    } finally {
      active.delete(key)
    }
  }
}

export const useActionLock = () => {
  const lock = useRef(null)
  if (!lock.current) lock.current = createActionLock()
  return useCallback((key, action) => lock.current(key, action), [])
}

