import { useRef, useState } from 'react'
import PortalIcon from './PortalIcon.jsx'

const VIEWS = [
  { id: 'records', label: 'Records', icon: 'violations' },
  { id: 'service', label: 'My Service', icon: 'clock' },
  { id: 'clearance', label: 'Clearance', icon: 'clearance' },
]

export default function LandingPreview() {
  const [view, setView] = useState('service')
  const tabRefs = useRef([])
  const changeByKeyboard = (event, index) => {
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % VIEWS.length
    else if (event.key === 'ArrowLeft') next = (index + VIEWS.length - 1) % VIEWS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = VIEWS.length - 1
    else return
    event.preventDefault()
    setView(VIEWS[next].id)
    tabRefs.current[next]?.focus()
  }

  return <div className="landing-preview" id="portal-preview" aria-label="Interactive sample student portal">
    <div className="landing-preview-top"><span className="landing-preview-brand"><PortalIcon name="clearance" size={20} /> Student Portal</span><span className="landing-demo-pill">Preview</span></div>
    <div className="landing-preview-tabs" role="tablist" aria-label="Explore sample portal views">
      {VIEWS.map((item, index) => <button key={item.id} ref={node => { tabRefs.current[index] = node }} type="button" role="tab" id={`preview-tab-${item.id}`} aria-controls={`preview-panel-${item.id}`} aria-selected={view === item.id} tabIndex={view === item.id ? 0 : -1} onClick={() => setView(item.id)} onKeyDown={event => changeByKeyboard(event, index)}><PortalIcon name={item.icon} size={16} />{item.label}</button>)}
    </div>
    {VIEWS.map(item => <div className="landing-preview-panel" key={item.id} hidden={item.id !== view} role="tabpanel" id={`preview-panel-${item.id}`} aria-labelledby={`preview-tab-${item.id}`} tabIndex={0}>
      {item.id === 'service' && <>
        <div className="landing-preview-heading"><div><span className="landing-mini-label">Community service</span><h2>Every hour counts.</h2></div><span className="landing-status">In Progress</span></div>
        <div className="landing-progress-summary"><strong>6<span> / 12 hrs</span></strong><span>50% complete</span></div>
        <div className="landing-progress-track" role="progressbar" aria-label="Sample service completion" aria-valuemin={0} aria-valuemax={12} aria-valuenow={6}><span /></div>
        <p className="landing-preview-caption">One step closer to completing your requirement.</p>
        <div className="landing-attendance-row"><span className="landing-preview-icon"><PortalIcon name="qr" size={22} /></span><div><strong>QR attendance recorded</strong><span>Sample session · 2 hours credited</span></div><PortalIcon name="check" size={20} /></div>
        <div className="landing-preview-bottom"><span><i /> Progress in one place</span><PortalIcon name="arrow-right" size={17} /></div>
      </>}
      {item.id === 'records' && <>
        <div className="landing-preview-heading"><div><span className="landing-mini-label">Your records</span><h2>Clarity comes first.</h2></div><span className="landing-status">For Review</span></div>
        <div className="landing-record-example"><span className="landing-preview-icon"><PortalIcon name="violations" size={24} /></span><span>Sample incident record<strong>Uniform requirement</strong></span></div>
        <dl className="landing-record-details"><div><dt>Recorded by</dt><dd>Discipline Office</dd></div><div><dt>Next step</dt><dd>Review your record</dd></div></dl>
        <p className="landing-preview-caption">See the details and follow your next steps after signing in.</p>
      </>}
      {item.id === 'clearance' && <>
        <div className="landing-preview-heading"><div><span className="landing-mini-label">Your clearance</span><h2>See what comes next.</h2></div><span className="landing-status">Pending</span></div>
        <ul className="landing-clearance-list"><li><PortalIcon name="check" /><span>Profile completed</span><small>Done</small></li><li><PortalIcon name="clock" /><span>Community service</span><small>6 hrs left</small></li><li><PortalIcon name="clearance" /><span>Discipline Office review</span><small>Pending</small></li></ul>
        <p className="landing-preview-caption">Completing service is one step. Clearance remains subject to office review.</p>
      </>}
    </div>)}
    <div className="landing-preview-disclaimer"><PortalIcon name="info" size={14} /> Interactive preview · Sample data</div>
  </div>
}
