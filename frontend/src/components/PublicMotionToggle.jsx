import PortalIcon from './PortalIcon.jsx'

export default function PublicMotionToggle({ mode, onToggle, className = '' }) {
  const full = mode === 'full'
  return <button className={`public-motion-toggle ${className}`} type="button" aria-pressed={full} aria-label={`Motion: ${full ? 'Full' : 'Reduced'}. ${full ? 'Reduce Motion' : 'Enable Full Motion'}`} title={full ? 'Reduce Motion' : 'Enable Full Motion'} onClick={onToggle}><PortalIcon name={full ? 'pause' : 'play'} size={18} /></button>
}
