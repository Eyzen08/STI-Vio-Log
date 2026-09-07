const metadata = {
  NEUTRAL: { tone: 'neutral', label: 'No qualifying offenses' },
  MINOR_1: { tone: 'yellow', label: '1 minor offense' },
  MINOR_2: { tone: 'orange', label: '2 minor offenses' },
  MAJOR_LEVEL: { tone: 'red', label: 'Major-level disciplinary status' },
  GRAVE: { tone: 'critical', label: 'Grave-offense disciplinary status' }
}

function OffenseIndicator({ level = 'NEUTRAL', label, compact = false }) {
  const item = metadata[level] || metadata.NEUTRAL
  const accessibleLabel = label || item.label
  return (
    <span className={`offense-indicator offense-${item.tone}`} title={accessibleLabel} aria-label={accessibleLabel}>
      <span className="offense-dot" aria-hidden="true" />
      {!compact && <span>{accessibleLabel}</span>}
    </span>
  )
}

export default OffenseIndicator

