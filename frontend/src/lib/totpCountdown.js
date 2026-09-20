export const totpSecondsRemaining = (timeMs, periodSeconds = 30) => {
  const period = Math.max(1, Number(periodSeconds) || 30)
  const elapsed = Math.floor(Number(timeMs) / 1000) % period
  return period - elapsed
}
