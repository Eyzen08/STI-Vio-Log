import { useState } from 'react'
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
    <div className="handbook-toolbar">
      <label htmlFor="handbook-document">Document
        <select id="handbook-document" value={documentId} onChange={event => setDocumentId(event.target.value)}>
          {HANDBOOK_DOCUMENTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="action-row">
        <a className="secondary-button" href={document.url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
        <a className="submit-btn" href={document.url} download>Download PDF</a>
      </div>
    </div>
    <p className="handbook-source">Saved copy captured <time dateTime="2026-10-12">12 October 2026</time>. STI’s issued version is authoritative. <a href="https://one.sti.edu/STI-BCT_Handbook.html#home" target="_blank" rel="noopener noreferrer">Open STI’s live handbook</a></p>
    <iframe key={document.id} className="handbook-reader" src={document.url} title={`${document.label} PDF`} />
    <p className="handbook-help">If the PDF does not display in your browser, use “Open in new tab” or “Download PDF” above.</p>
  </section>
}

export default HandbookPage
