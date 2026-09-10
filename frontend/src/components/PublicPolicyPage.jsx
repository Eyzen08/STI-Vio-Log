const POLICY_CONTENT = {
  privacy: {
    eyebrow: 'Privacy and data protection',
    title: 'Privacy Policy',
    summary: 'How STI Vio-Log handles account, discipline, community service, and clearance information.',
    sections: [
      ['Information handled by the portal', 'STI Vio-Log processes information needed to operate the school discipline and community service process. This may include account details, student number, school profile, guardian contact information, violation records, attendance and service records, clearance status, messages, and security or audit events.'],
      ['Why information is used', 'Information is used to authenticate users, administer student discipline, coordinate assigned community service, determine clearance eligibility, communicate with authorized users, protect the portal, and maintain accountable school records.'],
      ['Who can access information', 'Access is limited according to assigned roles. Students can review information made available to their own account. Authorized Discipline Office personnel, designated department personnel, and approved system support administrators can access only the information and functions required for their responsibilities.'],
      ['Retention and protection', 'Records are retained according to applicable STI Global City policies and legitimate administrative requirements. The portal uses access controls, audit records, encrypted connections in production, and other safeguards intended to prevent unauthorized access or alteration.'],
      ['Cookies, local storage, and analytics', 'The portal does not currently use advertising cookies or third-party behavioral analytics. It stores the signed-in session in browser storage so the account can remain available during normal portal use. If optional analytics or nonessential cookies are introduced, this policy and the appropriate consent controls must be updated before they are enabled.'],
      ['Your responsibilities and choices', 'Keep your credentials private, sign out on shared devices, and report suspected account misuse promptly. Requests to review or correct personal information should be directed to the Discipline Office so identity and authority can be verified.'],
      ['Questions or concerns', 'For privacy questions, record corrections, or account concerns, contact the STI Global City Discipline Office through an official school communication channel. Do not send passwords or other authentication secrets.'],
    ],
  },
  terms: {
    eyebrow: 'Acceptable use',
    title: 'Terms of Use',
    summary: 'Rules for authorized access to the STI Vio-Log school portal.',
    sections: [
      ['Authorized school use', 'STI Vio-Log is provided for legitimate student discipline, community service, clearance, communication, and system administration activities. Access is limited to approved users and the permissions assigned to their account.'],
      ['Account security', 'Users must provide accurate information, protect their credentials, and promptly report suspected unauthorized access. You may not share accounts, attempt to access another person\'s records, bypass security controls, or interfere with portal operation.'],
      ['Responsible records and communication', 'Authorized personnel must create and update records accurately and only for official purposes. Messages and uploaded information must remain appropriate for school operations and may be retained as official communication.'],
      ['Privacy and confidentiality', 'Student and disciplinary information is confidential. Users must not copy, disclose, photograph, or distribute portal information except when authorized by school policy and applicable requirements.'],
      ['Availability and enforcement', 'The school may restrict access, investigate activity, correct records, or preserve audit information when needed for security, policy enforcement, or portal maintenance. Features may occasionally be unavailable while maintenance or improvements are performed.'],
      ['Questions about these terms', 'Questions about access, records, or acceptable use should be directed to the STI Global City Discipline Office through an official school communication channel.'],
    ],
  },
}

function PublicPolicyPage({ type, onNavigate }) {
  const policy = POLICY_CONTENT[type] || POLICY_CONTENT.privacy

  return (
    <section className="public-policy-page">
      <header className="public-policy-header">
        <button type="button" className="public-policy-brand" onClick={() => onNavigate('/login')}>
          <span aria-hidden="true">STI</span>
          <strong>STI Vio-Log</strong>
        </button>
        <button type="button" className="public-policy-signin" onClick={() => onNavigate('/login')}>Sign in</button>
      </header>

      <article className="public-policy-card" aria-labelledby="public-policy-title">
        <div className="public-policy-intro">
          <p className="eyebrow">{policy.eyebrow}</p>
          <h1 id="public-policy-title">{policy.title}</h1>
          <p>{policy.summary}</p>
          <small>Effective September 10, 2026</small>
        </div>

        <div className="public-policy-sections">
          {policy.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>

        <footer className="public-policy-footer">
          <nav aria-label="Legal pages">
            <button type="button" onClick={() => onNavigate('/privacy')}>Privacy Policy</button>
            <button type="button" onClick={() => onNavigate('/terms')}>Terms of Use</button>
          </nav>
          <button type="button" className="public-policy-primary" onClick={() => onNavigate('/login')}>Return to sign in</button>
        </footer>
      </article>
    </section>
  )
}

export default PublicPolicyPage
