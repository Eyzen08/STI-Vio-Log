# STI Vio-Log authentication guide

## One login page

Open `/login`. Do not select a role. Enter either a staff username or a Student Number and the account password. The backend determines the role from the database and sends the account to its authorized dashboard.

## Create a Student account

1. Select **Create Student Account**.
2. Enter the full name, 11-digit Student Number in `02000XXXXXX` format, email, and a compliant password.
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

## Staff and Department Accounts

Only an ADMIN can create DISCIPLINE_OFFICE and DEPARTMENT_HEAD accounts. The generated temporary password is shown once to the ADMIN. On first login, the staff member must change it before any business API or portal page becomes available.

## Password requirements

- 8–128 characters
- At least one uppercase letter
- At least one number
- At least one special character

Use the accessible eye button beside a password field to show or hide its value.

## Email setup

The backend requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` for registration and recovery delivery. Keep real values only in the deployment environment; never commit them.
