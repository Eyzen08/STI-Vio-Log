# STI Vio-Log authentication guide

## One login page

Open `/login`. Do not select a role. Enter either a staff username or a Student Number and the account password. The backend determines the role from the database and sends the account to its authorized dashboard.

## Create a Student account

### Discipline Office-issued account

When the Discipline Admin or Discipline Officer creates a Student account, staff enter only the school-issued Student Number and the student's legal name. The backend generates the private QR value and the temporary credentials are displayed once. The student must then complete this locked sequence:

1. Sign in with the Student Number and temporary password.
2. Replace the temporary password.
3. Enter a Google-account email and confirm the six-digit code sent to that inbox.
4. Sign in with Google using the exact confirmed address. Personal Gmail and school-managed Google accounts are accepted.
5. Enter program, section, year level, the student's phone number, and the primary guardian's name, relationship, and phone number.
6. Continue to the portal.

The verified Google email becomes the account's password-recovery address. Student Number and legal name remain controlled by the Discipline Office and are read-only during onboarding. Academic, contact, and guardian details are saved together when the student completes onboarding; later corrections use the audited staff edit workflow. Signing out or refreshing during setup resumes the unfinished step. Accounts created before mandatory onboarding was introduced retain their existing access.

### Email-verified registration

1. Select **Create Student Account**.
2. Enter the full name, an exactly 11-digit Student Number, email, and a compliant password. Any 11-digit school-issued number is accepted; no fixed prefix is required.
3. Enter the six-digit code sent to the submitted email within ten minutes.
4. After verification, return to the unified login and sign in using the Student Number and password.

The account is not created or activated before successful email verification. A resent code invalidates the previous code.

## Reset a Student password

1. Select **Forgot Password?** on `/login`.
2. Enter the Student Number or registered email.
3. The system always shows the same response, whether or not an account matches.
4. Enter the code delivered to the account's registered email.
5. Create a new compliant password.

The reset code and reset authorization are single-use and expire. A successful reset invalidates existing sessions.

For Discipline Office-issued accounts, recovery becomes available after mandatory Google binding. Codes are sent to the verified email supplied by Google.

## Staff and Department Accounts

Only an ADMIN can create DISCIPLINE_OFFICE and DEPARTMENT_HEAD accounts. The generated temporary password is shown once to the ADMIN. On first login, the staff member must change it before any business API or portal page becomes available.

## Password requirements

- 8–128 characters
- At least one uppercase letter
- At least one number
- At least one special character

Use the accessible eye button beside a password field to show or hide its value.

## Email setup

For production, configure the Brevo HTTPS API with `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and optionally `BREVO_SENDER_NAME`. The sender email must be verified in Brevo. `EMAIL_TIMEOUT_MS` defaults to 10000 milliseconds. Brevo is preferred automatically when configured.

SMTP remains an optional fallback for local development or paid hosts through `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`; `SMTP_TIMEOUT_MS` defaults to 10000 milliseconds. Free Render services block outbound SMTP ports, so production on Render Free must use the Brevo HTTPS configuration. Keep all real keys and credentials only in the deployment environment; never commit them.
