const metadata = {
  NEUTRAL: { tone: 'neutral', label: 'No Qualifying Offenses' },
  MINOR_1: { tone: 'yellow', label: '1 Minor Offense' },
  MINOR_2: { tone: 'orange', label: '2 Minor Offenses' },
  MAJOR_LEVEL: { tone: 'red', label: 'Major-Level Disciplinary Status' },
  GRAVE: { tone: 'critical', label: 'Grave-Offense Disciplinary Status' }
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

