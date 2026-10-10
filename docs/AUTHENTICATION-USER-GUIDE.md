# STI Vio-Log authentication guide

## One login page

Open `/login`. Do not select a role. Enter either a staff username or a Student Number and the account password. The backend determines the role from the database and sends the account to its authorized dashboard.

## Create a Student account

### Discipline Office-issued account

When the Discipline Admin or Discipline Officer creates a Student account, staff enter the school-issued Student Number, legal name, optional middle name/suffix, and personal Gmail. Select **Review Details** to check the normalized entries; optional blanks appear as **None**. **Back to Edit** preserves the entries. No account is created until **Confirm and Create Account** succeeds.

The backend generates the private QR value and displays temporary credentials once. Staff can explicitly send the credentials and login link by email or share them securely. In this dialog, **Edit Gmail** allows a correction with a required reason. **Save Gmail** replaces the temporary password, invalidates the old password and recovery/session authorizations, and starts a fresh 24-hour expiry. Review the corrected address and select **Send Email** separately; saving never sends mail. Delivery failure preserves the saved credentials for retry. Credentials already sent to a wrong inbox cannot be recalled, but the replaced password stops working. Activated accounts use the existing staff edit or Google recovery workflow.

Temporary passwords expire after 24 hours; issuing a replacement invalidates the previous password. The student must then complete this locked sequence:

1. Sign in with the Student Number and temporary password.
2. Replace the temporary password.
3. Confirm the six-digit code sent to the personal Gmail recorded by staff. The address is read-only; corrections require Discipline Office assistance.
4. Sign in with Google using that exact confirmed personal Gmail. Google proves ownership of its identity separately from Vio-Log’s emailed code.
5. Select College or Senior High School. College requires program and year 1-4; SHS requires ABM or STEM and Grade 11 or 12. Enter section, the student's phone number, and the primary guardian's name, relationship, and phone number.
6. Continue to the portal.

The verified Google email becomes the account's password-recovery address. Student Number and legal name remain controlled by the Discipline Office and are read-only during onboarding. Academic, contact, and guardian details are saved together when the student completes onboarding; later corrections use the audited staff edit workflow. Signing out or refreshing during setup resumes the unfinished step. Accounts created before mandatory onboarding was introduced retain their existing access.

### Retired email-verified registration (historical)

Public self-registration is retired. The following sequence describes historical registrations only. New accounts are issued by the Discipline Office.

1. Select **Create Student Account** (historical UI).
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

The reset code expires after ten minutes and allows five failed attempts, including attempts in failed transactions. Resends have a sixty-second cooldown. The reset authorization is single-use and expires after fifteen minutes. A successful reset invalidates existing sessions.

For Discipline Office-issued accounts, recovery codes are sent to the recorded personal Gmail. Unknown Google accounts must first use their issued Student Number and temporary password; public Google linking and public sign-up are unavailable.

## Staff-assisted Google recovery

Staff must check the student’s identity against school records, enter the replacement personal Gmail (or retain the existing Gmail), and record a reason. Recovery revokes the old Google link, browser sessions, outstanding OTPs, and reset authorizations. The student signs in with local credentials, verifies the recorded Gmail, and binds its Google identity before portal access resumes. Academic and disciplinary records remain attached. A recovered legacy account returns directly to the portal after binding without repeating the profile form.

Duplicate Review separately shows stored duplicates and the latest 50 rejected Student Number, Gmail, or Google identity conflicts. It never displays passwords, verification codes, or Google tokens.

## Rollout and verification

Apply migration `048_student_account_activation_security.sql` before deploying the updated backend. Existing student temporary credentials receive a fresh 24-hour window on upgrade; legacy students are not forced through onboarding.

Run `npm test` in both projects, and `npm run lint` / `npm run build` in the frontend. Against a disposable PostgreSQL database, set `TEST_DATABASE_URL` and run `npm run test:migrations` and `npm run test:account-security` in the backend. The test database must differ from the runtime database.

## Staff and Department Accounts

Only DISCIPLINE_ADMIN can create DISCIPLINE_OFFICE and DEPARTMENT_HEAD accounts. The generated temporary password is shown once to that administrator. On first login, the staff member must change it before any business API or portal page becomes available.

## Password requirements

- 8–128 characters
- At least one uppercase letter
- At least one number
- At least one special character

Use the accessible eye button beside a password field to show or hide its value.

## Email setup

For production, configure the Brevo HTTPS API with `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and optionally `BREVO_SENDER_NAME`. The sender email must be verified in Brevo. `EMAIL_TIMEOUT_MS` defaults to 10000 milliseconds. Brevo is selected when configured; a failed Brevo request does not automatically retry through SMTP. Sender metadata was observed in the October 10 audit, but actual delivery and Render variable presence remain unverified.

SMTP remains an alternative configuration for local development or suitable paid hosts through `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`; `SMTP_TIMEOUT_MS` defaults to 10000 milliseconds. [Render Free documentation](https://render.com/docs/free) confirms outbound ports 25, 465 and 587 are blocked, so this project's Free deployment should use Brevo HTTPS. Keep all real keys and credentials only in the deployment environment; never commit them.


## College and Senior High School support

The system supports College programs (years 1-4 for new academic submissions) and Senior High School **ABM** (Accountancy, Business, and Management) and **STEM** (Science, Technology, Engineering, and Mathematics), Grades 11-12. SHS requires a strand and section instead of a College program. Both modes retain the same Student role and authorization rules. See the [student academic model](STUDENT-ACADEMIC-MODEL.md) for account setup, audited corrections, API fields, historical records, migration 043, and acceptance examples.
