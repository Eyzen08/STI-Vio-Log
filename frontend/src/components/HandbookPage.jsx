import { useState } from 'react'
import PortalIcon from './PortalIcon.jsx'
import '../styles/handbook.css'

export const HANDBOOK_DOCUMENTS = [
  { id: 'complete', label: 'Complete Tertiary Handbook', url: '/handbook/sti-tertiary-handbook-july-2026.pdf' },
  { id: 'offenses', label: 'Offenses', url: '/handbook/sti-offenses-july-2026.pdf' },
  { id: 'measures', label: 'Disciplinary Measures', url: '/handbook/sti-disciplinary-measures-july-2026.pdf' },
  { id: 'discipline', label: 'Student Discipline', url: '/handbook/sti-student-discipline-july-2026.pdf' },
]

function HandbookPage() {
  const [documentId, setDocumentId] = useState('complete')
  const document = HANDBOOK_DOCUMENTS.find(item => item.id === documentId)

  return <section className="handbook-page" aria-labelledby="handbook-title">
    <header className="management-page-header portal-page-header">
      <div><span className="page-breadcrumb">Home / STI Handbook</span><h2 id="handbook-title">STI Handbook</h2><p>STI Tertiary Student Handbook · July 2026 edition</p></div>
    </header>
    <div className="handbook-library">
      <nav className="handbook-documents" aria-label="Handbook documents">
        <h3>Document Library</h3><p>Select a document to read.</p>
        {HANDBOOK_DOCUMENTS.map(item => <button key={item.id} type="button" aria-pressed={item.id === documentId} onClick={() => setDocumentId(item.id)}><PortalIcon name="book" size={20}/><span>{item.label}<small>July 2026 · PDF</small></span><PortalIcon name="chevron-right" size={16}/></button>)}
      </nav>
      <div className="handbook-reading-area">
        <header className="handbook-toolbar">
          <div><span className="eyebrow">Now Reading</span><h3>{document.label}</h3></div>
          <div className="action-row">
            <a className="secondary-button" href={document.url} target="_blank" rel="noopener noreferrer">Open PDF<span className="sr-only"> (new tab)</span></a>
            <a className="submit-btn" href={document.url} download>Download PDF</a>
          </div>
        </header>
        <iframe key={document.id} src={document.url} title={`${document.label} PDF reader`} />
        <p className="handbook-reader-help">PDF not displaying? Use Open PDF to read it in a new tab, or download a copy.</p>
      </div>
    </div>
    <p className="handbook-source">Saved copy captured <time dateTime="2026-10-12">12 October 2026</time>. STI’s issued version is authoritative. <a href="https://one.sti.edu/STI-BCT_Handbook.html#home" target="_blank" rel="noopener noreferrer">Open STI’s Live Handbook</a></p>
  </section>
}

export default HandbookPage
