import { Fragment, useState } from 'react'
import PortalIcon from './PortalIcon.jsx'
import '../styles/handbook.css'

const TERTIARY_LIVE_URL = 'https://one.sti.edu/STI-BCT_Handbook.html#home'
const SENIOR_HIGH_LIVE_URL = 'https://one.sti.edu/STI-SHS_Handbook.html#home'

export const HANDBOOK_DOCUMENTS = [
  { id: 'complete', group: 'Tertiary', label: 'Complete Tertiary Handbook', edition: 'July 2026', liveUrl: TERTIARY_LIVE_URL, url: '/handbook/sti-tertiary-handbook-july-2026.pdf' },
  { id: 'offenses', group: 'Tertiary', label: 'Offenses', edition: 'July 2026', liveUrl: TERTIARY_LIVE_URL, url: '/handbook/sti-offenses-july-2026.pdf' },
  { id: 'measures', group: 'Tertiary', label: 'Disciplinary Measures', edition: 'July 2026', liveUrl: TERTIARY_LIVE_URL, url: '/handbook/sti-disciplinary-measures-july-2026.pdf' },
  { id: 'discipline', group: 'Tertiary', label: 'Student Discipline', edition: 'July 2026', liveUrl: TERTIARY_LIVE_URL, url: '/handbook/sti-student-discipline-july-2026.pdf' },
  { id: 'senior-high', group: 'Senior High School', label: 'Complete Senior High School Handbook', edition: 'July 2026', liveUrl: SENIOR_HIGH_LIVE_URL, url: '/handbook/sti-senior-high-school-handbook-july-2026.pdf' },
]

const DOCUMENT_GROUPS = [...new Set(HANDBOOK_DOCUMENTS.map(item => item.group))]

function HandbookPage() {
  const [documentId, setDocumentId] = useState('complete')
  const document = HANDBOOK_DOCUMENTS.find(item => item.id === documentId)

  return <section className="handbook-page" aria-labelledby="handbook-title">
    <header className="management-page-header portal-page-header">
      <div><span className="page-breadcrumb">Home / STI Handbook</span><h2 id="handbook-title">STI Handbook</h2><p>STI Student Handbooks · Tertiary and Senior High School · July 2026 edition</p></div>
      <a className="handbook-live-link" href={document.liveUrl} target="_blank" rel="noopener noreferrer">Open STI’s Live Handbook<PortalIcon name="arrow-right" size={18}/><span className="sr-only"> (new tab)</span></a>
    </header>
    <div className="handbook-library">
      <nav className="handbook-documents" aria-label="Handbook documents">
        <h3>Document Library</h3><p>Select a document to read.</p>
        {DOCUMENT_GROUPS.map(group => <Fragment key={group}>
          <p className="handbook-doc-group">{group}</p>
          {HANDBOOK_DOCUMENTS.filter(item => item.group === group).map(item => <button key={item.id} type="button" aria-pressed={item.id === documentId} onClick={() => setDocumentId(item.id)}><PortalIcon name="book" size={20}/><span>{item.label}<small>{item.edition} · PDF</small></span><PortalIcon name="chevron-right" size={16}/></button>)}
        </Fragment>)}
      </nav>
      <div className="handbook-reading-area">
        <header className="handbook-toolbar">
          <div><span className="eyebrow">Now Reading</span><h3>{document.label}</h3></div>
          <div className="action-row">
            <a className="handbook-open-pdf" href={document.url} target="_blank" rel="noopener noreferrer">Open PDF<PortalIcon name="arrow-right" size={18}/><span className="sr-only"> (new tab)</span></a>
            <a className="handbook-download-pdf" href={document.url} download>Download PDF</a>
          </div>
        </header>
        <iframe key={document.id} src={document.url} title={`${document.label} PDF reader`} />
        <p className="handbook-reader-help">PDF not displaying? Use Open PDF to read it in a new tab, or download a copy.</p>
      </div>
    </div>
    <p className="handbook-source">Saved copies captured <time dateTime="2026-10-12">12 October 2026</time> (tertiary) and <time dateTime="2026-11-25">25 November 2026</time> (Senior High School). STI’s issued version is authoritative.</p>
  </section>
}

export default HandbookPage
