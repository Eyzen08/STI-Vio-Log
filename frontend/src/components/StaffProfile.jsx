import PortalIcon from './PortalIcon.jsx'

const roleLabels = {
  SYSTEM_ADMIN: 'System Administrator',
  DISCIPLINE_ADMIN: 'Discipline Administrator',
  DISCIPLINE_OFFICE: 'Discipline Officer',
  DEPARTMENT_HEAD: 'Department Head'
}

const valueOrFallback = (value, fallback = 'Not provided') => {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function ProfileField({ label, value }) {
  const missing = value === 'Not provided' || value === 'Not assigned'
  return <div className="profile-field"><dt>{label}</dt><dd className={missing ? 'profile-value-missing' : ''}>{value}</dd></div>
}

function StaffProfile({ user, onNavigate }) {
  const displayName = valueOrFallback(user?.full_name, [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Portal User')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'
  const role = roleLabels[user?.role] || valueOrFallback(String(user?.role || '').replaceAll('_', ' '), 'Portal User')
  const department = valueOrFallback(user?.department_name || user?.department_code, 'Not assigned')
  const settingsPath = user?.role === 'SYSTEM_ADMIN' ? '/system/account-settings' : user?.role === 'DEPARTMENT_HEAD' ? '/department/account-settings' : '/admin/account-settings'

  return <section className="profile-card staff-profile-card" aria-labelledby="staff-profile-title">
    <header className="profile-hero">
      <div className="profile-avatar" aria-hidden="true">{initials}</div>
      <div className="staff-profile-identity">
        <p className="eyebrow">Account Profile</p>
        <h2 id="staff-profile-title">{displayName}</h2>
        <p>{role}{user?.department_name ? ` · ${user.department_name}` : ''}</p>
      </div>
      <span className="profile-readonly-badge"><PortalIcon name="check"/> Authenticated Account</span>
    </header>

    <div className="profile-section">
      <div className="profile-section-heading"><h3>School Identity</h3><p>Your account details and assigned responsibility.</p></div>
      <dl className="profile-details-grid">
        <ProfileField label="Full Name" value={displayName} />
        <ProfileField label="Username" value={valueOrFallback(user?.username)} />
        <ProfileField label="Role" value={role} />
        <ProfileField label="Employee Number" value={valueOrFallback(user?.employee_number)} />
      </dl>
    </div>

    <div className="profile-section">
      <div className="profile-section-heading"><h3>Assignment & Contact</h3><p>Information connected to your school account.</p></div>
      <dl className="profile-details-grid">
        <ProfileField label="Department" value={department} />
        <ProfileField label="Department Code" value={valueOrFallback(user?.department_code, 'Not assigned')} />
        <ProfileField label="Email Address" value={valueOrFallback(user?.email)} />
        <ProfileField label="Account Status" value={user?.is_active === false ? 'Inactive' : 'Active'} />
      </dl>
    </div>

    <footer className="profile-help staff-profile-footer">
      <p>Profile details are based on your authenticated school account.</p>
      <button type="button" className="secondary-button" onClick={() => onNavigate(settingsPath)}><PortalIcon name="settings"/> Open Account Settings</button>
    </footer>
  </section>
}

export default StaffProfile
