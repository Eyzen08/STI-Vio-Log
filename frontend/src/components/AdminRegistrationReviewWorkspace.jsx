import { useState } from 'react'
import AdminDuplicateReview from './AdminDuplicateReview.jsx'
import GoogleRegistrationReview from './GoogleRegistrationReview.jsx'

function AdminRegistrationReviewWorkspace({ token, role, onPendingCountChange }) {
  const canReviewDuplicates = role === 'DISCIPLINE_ADMIN'
  const [activeTab, setActiveTab] = useState('registrations')

  return <section className="registration-review-workspace" aria-labelledby="registration-workspace-title">
    <header className="management-page-header">
      <div>
        <span className="page-breadcrumb">Home / Student Record Review</span>
        <h2 id="registration-workspace-title">Registration &amp; Duplicate Review</h2>
        <p>Review student access requests and investigate possible account conflicts in one secure workspace.</p>
      </div>
      <span className="readonly-badge">Secure identity review</span>
    </header>

    {canReviewDuplicates && <nav className="review-workspace-tabs" aria-label="Student record review sections">
      <button type="button" className={activeTab === 'registrations' ? 'active' : ''} aria-current={activeTab === 'registrations' ? 'page' : undefined} onClick={() => setActiveTab('registrations')}>Registration Review</button>
      <button type="button" className={activeTab === 'duplicates' ? 'active' : ''} aria-current={activeTab === 'duplicates' ? 'page' : undefined} onClick={() => setActiveTab('duplicates')}>Duplicate Review</button>
    </nav>}

    {activeTab === 'duplicates' && canReviewDuplicates
      ? <AdminDuplicateReview token={token} embedded />
      : <GoogleRegistrationReview token={token} onPendingCountChange={onPendingCountChange} embedded />}
  </section>
}

export default AdminRegistrationReviewWorkspace
