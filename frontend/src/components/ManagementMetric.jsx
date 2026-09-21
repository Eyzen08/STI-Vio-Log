import PortalIcon from './PortalIcon.jsx'

function ManagementMetric({ tone = 'blue', icon = 'dashboard', value, label }) {
  return <article className={`management-metric metric-${tone}`}>
    <i><PortalIcon name={icon} size={20}/></i>
    <div><strong>{value}</strong><span>{label}</span></div>
  </article>
}

export default ManagementMetric
