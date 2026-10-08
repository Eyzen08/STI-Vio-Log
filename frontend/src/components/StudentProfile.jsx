import { academicLevelLabel, academicProgram, academicYear, isSeniorHigh } from '../lib/studentAcademic.js'
import { displayProfileValue, formatStudentName } from '../lib/studentProfile.js'
import Avatar from './Avatar.jsx'
import { displayPhilippinePhone } from '../lib/phone.js'
import '../styles/student-portal.css'

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
      <section className="student-page profile-card" aria-live="polite">
        <div className="skeleton profile-heading-skeleton" />
        <div className="profile-details-grid">
          {[1, 2, 3, 4, 5, 6].map((item) => <div className="skeleton profile-field-skeleton" key={item} />)}
        </div>
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="student-page profile-card profile-unavailable">
        <p className="eyebrow">Student profile</p>
        <h2>Profile Information Is Unavailable</h2>
        <p>{error || 'No student record is linked to this account.'}</p>
      </section>
    )
  }


  return (
    <section className="student-page student-profile-page">
      <header className="profile-hero student-profile-identity">
        <Avatar className="profile-avatar" identity={{ ...profile, username }} />
        <div>
          <h2>{formatStudentName(profile)}</h2>
          <p>{profile.student_number}</p>
        </div>
        <span className="profile-readonly-badge">Verified school record</span>
      </header>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="profile-section">
        <div className="profile-section-heading">
          <h3>Academic information</h3>
        </div>
        <dl className="profile-details-grid">
          <ProfileField label="Student number" value={displayProfileValue(profile.student_number)} />
          <ProfileField label="Academic level" value={academicLevelLabel(profile)} /><ProfileField label={isSeniorHigh(profile)?"Strand":"Program"} value={academicProgram(profile)} />
          <ProfileField label={isSeniorHigh(profile)?"Grade level":"Year level"} value={academicYear(profile)} />
          <ProfileField label="Section" value={displayProfileValue(profile.section)} />
        </dl>
      </div>

      <div className="profile-section">
        <div className="profile-section-heading">
          <h3>Contact and account</h3>
        </div>
        <dl className="profile-details-grid">
          <ProfileField label="Email address" value={displayProfileValue(profile.email)} />
          <ProfileField label="Phone number" value={displayProfileValue(displayPhilippinePhone(profile.phone_number))} />
          <ProfileField label="Guardian Contact phone number" value={displayProfileValue(displayPhilippinePhone(profile.guardian_phone_number))} />
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
