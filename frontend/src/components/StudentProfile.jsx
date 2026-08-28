import { displayProfileValue, formatStudentName, formatYearLevel } from '../lib/studentProfile.js'

function ProfileField({ label, value }) {
  const isMissing = value === 'Not provided'
  return (
    <div className="profile-field">
      <dt>{label}</dt>
      <dd className={isMissing ? 'profile-value-missing' : ''}>{value}</dd>
    </div>
  )
}

function StudentProfile({ profile, username, loading, error }) {
  if (loading) {
    return (
      <section className="profile-card" aria-live="polite">
        <div className="skeleton profile-heading-skeleton" />
        <div className="profile-details-grid">
          {[1, 2, 3, 4, 5, 6].map((item) => <div className="skeleton profile-field-skeleton" key={item} />)}
        </div>
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="profile-card profile-unavailable">
        <p className="eyebrow">Student profile</p>
        <h2>Profile information is unavailable.</h2>
        <p>{error || 'No student record is linked to this account.'}</p>
      </section>
    )
  }

  const initials = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .map((name) => name.trim().charAt(0).toUpperCase())
    .join('') || 'ST'

  return (
    <section className="profile-card">
      <header className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <div>
          <p className="eyebrow">Student profile</p>
          <h2>{formatStudentName(profile)}</h2>
          <p>{profile.student_number} · {displayProfileValue(profile.program)}</p>
        </div>
        <span className="profile-readonly-badge">Verified school record</span>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="profile-section">
        <div className="profile-section-heading">
          <h3>Academic information</h3>
          <p>Your current enrollment details.</p>
        </div>
        <dl className="profile-details-grid">
          <ProfileField label="Student number" value={displayProfileValue(profile.student_number)} />
          <ProfileField label="Program" value={displayProfileValue(profile.program)} />
          <ProfileField label="Year level" value={formatYearLevel(profile.year_level)} />
          <ProfileField label="Section" value={displayProfileValue(profile.section)} />
        </dl>
      </div>

      <div className="profile-section">
        <div className="profile-section-heading">
          <h3>Contact and account</h3>
          <p>Information used to identify and contact you.</p>
        </div>
        <dl className="profile-details-grid">
          <ProfileField label="Email address" value={displayProfileValue(profile.email)} />
          <ProfileField label="Phone number" value={displayProfileValue(profile.phone_number)} />
          <ProfileField label="Parent/Guardian phone number" value={displayProfileValue(profile.guardian_phone_number)} />
          <ProfileField label="Portal username" value={displayProfileValue(username)} />
        </dl>
      </div>

      <p className="profile-help">
        This information is read-only. Contact the Discipline Office if a school record needs correction.
      </p>
    </section>
  )
}

export default StudentProfile
