# STI Vio-Log — Vibe Coding Development Roadmap

## 1. Project Overview

**System Name:** STI Vio-Log

**System Type:** Web-Based Student Violation, Community Service, QR Attendance, Parent/Guardian Communication, and Clearance Management System.

### Main Goal

Build a web application that allows STI to digitally manage:

- Student violations
- Community service requirements
- Student QR codes
- Department QR scanning
- Time-in / time-out
- Digital DTR
- Multi-department monitoring
- Parent/guardian contact
- Non-compliance
- Notifications
- Student communication
- Clearance
- Good disciplinary standing
- Enrollment verification
- Reports and audit logs

---

# 2. Recommended Technology Stack

## Frontend

- React
- Vite
- Tailwind CSS
- React Router
- Axios
- QR code display library
- Browser QR scanner library

## Backend

- Node.js
- Express.js
- REST API
- JWT authentication
- bcrypt password hashing

## Database

- PostgreSQL

## Development

- VS Code
- Git
- GitHub

## Deployment

Recommended structure:

- Frontend: Vercel or equivalent
- Backend: Render/Railway or equivalent
- Database: Managed PostgreSQL

---

# 3. User Roles

## STUDENT

Can:

- Login/logout
- View profile
- View personal QR code
- View violations
- View community service
- View service progress
- View DTR
- View notifications
- View messages
- View clearance status
- View/download eligible clearance or good-standing document

Cannot:

- Create violations
- Edit DTR
- Change clearance
- Access another student's private information

## DEPARTMENT_HEAD

Can:

- Login/logout
- Access department dashboard
- Scan student QR codes
- Time-in students
- Time-out students
- View authorized student records
- View DTR
- Monitor assigned community service
- View non-compliant students
- View authorized parent/guardian contact information
- Call/message parent/guardian using available contact action
- Record parent/guardian contact attempts
- View department reports

## DO_ADMIN

Can:

- Manage students
- Create/manage violations
- Assign community service
- Monitor service completion
- Review DTR
- Monitor non-compliance
- Manage clearance
- Manage good-standing status
- Send notifications
- Communicate with students
- Review parent contact logs
- Generate reports

## SYSTEM_ADMIN

Can:

- Manage users
- Manage departments
- Manage roles and permissions
- Manage system settings
- View audit logs

---

# 4. Core System Workflow

Student receives violation:

Student
→ Violation recorded
→ Community service assigned
→ Student notified
→ Student reports to assigned department
→ Department Head scans student QR
→ Time-In recorded
→ Student performs service
→ Department Head scans QR / records Time-Out
→ DTR calculates duration
→ Community service progress updates
→ Requirement becomes completed or remains pending
→ If overdue, student becomes non-compliant
→ Authorized staff can contact parent/guardian
→ Contact attempt is logged
→ Once all requirements are completed, student becomes CLEARED

---

# 5. Clearance and Good Standing Rules

Use these statuses:

- GOOD_STANDING
- CLEARED
- NOT_CLEARED

## GOOD_STANDING

Student has no recorded violations during the applicable academic period.

Display:

"GOOD DISCIPLINARY STANDING"

## CLEARED

Student previously had a violation but all disciplinary requirements have been completed.

Display:

"CLEARED"

## NOT_CLEARED

Student has at least one unresolved violation or incomplete required action.

Display:

"NOT CLEARED"

Important:

Do NOT delete completed violations. Keep the history and change the violation/service status to completed/cleared.

---

# 6. Main Database Tables

Create these tables:

```text
users
students
guardians
departments
department_staff
violation_types
violations
community_services
qr_codes
dtr_records
notifications
messages
parent_contact_logs
clearances
audit_logs
```

## users

```text
id
email
password_hash
role
status
created_at
updated_at
```

## students

```text
id
user_id
student_number
first_name
middle_name
last_name
program
year_level
section
qr_identifier
created_at
updated_at
```

## guardians

```text
id
student_id
name
relationship
contact_number
secondary_contact
is_primary
created_at
updated_at
```

## departments

```text
id
name
code
status
created_at
updated_at
```

## department_staff

```text
id
user_id
department_id
position
status
```

## violation_types

```text
id
name
description
default_service_hours
severity
status
```

## violations

```text
id
student_id
violation_type_id
description
violation_date
status
assigned_hours
deadline
created_by
created_at
updated_at
```

## community_services

```text
id
student_id
violation_id
required_hours
completed_hours
remaining_hours
status
start_date
deadline
created_at
updated_at
```

## qr_codes

```text
id
student_id
qr_identifier
status
created_at
updated_at
```

## dtr_records

```text
id
student_id
department_id
scanned_by
service_id
date
time_in
time_out
total_hours
status
created_at
updated_at
```

## notifications

```text
id
user_id
title
message
type
is_read
created_at
```

## messages

```text
id
sender_id
receiver_id
message
is_read
created_at
```

## parent_contact_logs

```text
id
student_id
guardian_id
staff_id
department_id
contact_method
reason
remarks
contacted_at
```

## clearances

```text
id
student_id
semester
academic_year
status
issued_by
issued_at
remarks
```

## audit_logs

```text
id
user_id
action
target_type
target_id
ip_address
created_at
```

---

# 7. Project Structure

```text
sti-vio-log/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── context/
│   │   └── App.jsx
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── config/
│   │   └── server.js
│   ├── .env
│   └── package.json
│
├── database/
│   ├── migrations/
│   └── seed/
│
├── docs/
│
├── .gitignore
└── README.md
```

---

# 8. Development Phases

## PHASE 1 — Project Setup

- [ ] Create root project folder
- [ ] Create frontend folder
- [ ] Create backend folder
- [ ] Create database folder
- [ ] Initialize Git
- [ ] Create GitHub repository
- [ ] Create `.gitignore`
- [ ] Create README
- [ ] Install frontend dependencies
- [ ] Install backend dependencies

Do not build dashboards yet.

---

## PHASE 2 — Database

- [ ] Create PostgreSQL database
- [ ] Create users table
- [ ] Create students table
- [ ] Create guardians table
- [ ] Create departments table
- [ ] Create department_staff table
- [ ] Create violation_types table
- [ ] Create violations table
- [ ] Create community_services table
- [ ] Create qr_codes table
- [ ] Create dtr_records table
- [ ] Create notifications table
- [ ] Create messages table
- [ ] Create parent_contact_logs table
- [ ] Create clearances table
- [ ] Create audit_logs table
- [ ] Add foreign keys
- [ ] Add indexes
- [ ] Add seed/test data

---

## PHASE 3 — Backend Foundation

- [ ] Create Express server
- [ ] Configure dotenv
- [ ] Configure CORS
- [ ] Connect PostgreSQL
- [ ] Create `/api/health`
- [ ] Add error handling
- [ ] Add request validation
- [ ] Add authentication middleware
- [ ] Add authorization middleware
- [ ] Add API route structure

Expected test:

```text
GET /api/health
```

should return a successful API response.

---

## PHASE 4 — Authentication

Create:

```text
POST /api/auth/login
GET /api/auth/me
POST /api/auth/logout
```

Implement:

- [ ] Password hashing
- [ ] Password verification
- [ ] Authentication token/session
- [ ] Account status check
- [ ] Role checking
- [ ] Protected routes
- [ ] Logout
- [ ] Invalid login handling

Roles:

```text
STUDENT
DEPARTMENT_HEAD
DO_ADMIN
SYSTEM_ADMIN
```

---

# 9. Backend API Modules

## Students

```text
GET    /api/students/me
GET    /api/students/:id
PUT    /api/students/:id
```

## Violations

```text
GET    /api/violations
POST   /api/violations
GET    /api/violations/:id
PUT    /api/violations/:id
DELETE /api/violations/:id
```

## Community Service

```text
GET  /api/community-service
POST /api/community-service
GET  /api/community-service/:id
PUT  /api/community-service/:id
```

## QR

```text
GET  /api/qr/student
POST /api/qr/scan
```

## DTR

```text
POST /api/dtr/time-in
POST /api/dtr/time-out
GET  /api/dtr
```

## Guardians

```text
GET  /api/students/:id/guardians
POST /api/students/:id/guardians
PUT  /api/guardians/:id
```

## Parent Contact

```text
POST /api/parent-contact
GET  /api/parent-contact/:studentId
```

## Notifications

```text
GET /api/notifications
PUT /api/notifications/:id/read
```

## Messages

```text
GET  /api/messages
POST /api/messages
```

## Clearance

```text
GET  /api/clearance/:studentId
POST /api/clearance/:studentId/issue
```

## Reports

```text
GET /api/reports/violations
GET /api/reports/dtr
GET /api/reports/community-service
GET /api/reports/non-compliance
GET /api/reports/parent-contacts
GET /api/reports/clearance
```

---

# 10. Frontend Pages

## Authentication

```text
/login                  Account-type chooser / existing staff password login
/student/login          Student Google sign-in and registration
/department/login       Approved Department Head Google sign-in
/department/register    Pending Department Head Google registration
```

## Student

```text
/student/dashboard
/student/profile
/student/qr
/student/violations
/student/community-service
/student/dtr
/student/notifications
/student/messages
/student/clearance
```

## Department Head

```text
/department/dashboard
/department/scanner
/department/students
/department/dtr
/department/community-service
/department/non-compliance
/department/parent-contacts
/department/reports
```

## Disciplinary Office

```text
/do/dashboard
/do/students
/do/violations
/do/community-service
/do/dtr
/do/non-compliance
/do/clearance
/do/notifications
/do/messages
/do/reports
```

## System Admin

```text
/admin/dashboard
/admin/users
/admin/departments
/admin/permissions
/admin/audit-logs
/admin/settings
```

---

# 11. Student Features

Build in this order:

1. [ ] Student dashboard
2. [ ] Student profile
3. [ ] Student QR code
4. [ ] Violations page
5. [ ] Community service page
6. [ ] DTR page
7. [ ] Notifications
8. [ ] Messages
9. [ ] Clearance page

Dashboard should show:

```text
Student Name
Disciplinary Status
Current Violations
Community Service Progress
Remaining Hours
Latest DTR
Latest Notifications
Clearance Status
```

---

# 12. QR and DTR Feature

This is one of the most important system features.

Workflow:

```text
Student Login
    ↓
Student QR
    ↓
Department Head Login
    ↓
Open QR Scanner
    ↓
Scan Student QR
    ↓
Backend validates QR
    ↓
Find Student
    ↓
Show Student Information
    ↓
TIME IN / TIME OUT
    ↓
Save DTR
    ↓
Calculate Total Hours
    ↓
Update Community Service
```

Rules:

- [ ] Student QR must be unique
- [ ] QR must be validated by backend
- [ ] Unauthorized users cannot scan
- [ ] Duplicate Time-In must be prevented
- [ ] Time-Out requires valid Time-In
- [ ] Staff member who scanned must be recorded
- [ ] Department must be recorded
- [ ] Date must be recorded
- [ ] Service activity must be linked when applicable

Never place passwords or sensitive personal information inside the QR.

---

# 13. Community Service

Example rules:

```text
Minor = 2 hours
Major = 5 hours
Grave = 10+ hours
```

Progress calculation:

```text
remaining_hours = required_hours - completed_hours
```

Progress:

```text
completed_hours / required_hours * 100
```

Statuses:

```text
PENDING
IN_PROGRESS
COMPLETED
OVERDUE
NON_COMPLIANT
```

---

# 14. Non-Compliance

Trigger non-compliance when:

- Deadline passed
- Required hours remain incomplete
- Student ignores required action
- DO/Admin manually marks non-compliance

Show:

```text
Student
Violation
Required Hours
Completed Hours
Remaining Hours
Deadline
Non-Compliance Reason
```

---

# 15. Parent/Guardian Feature

Student profile contains:

```text
Guardian Name
Relationship
Primary Contact Number
Secondary Contact Number
```

Only authorized users can access it.

Department Head/DO Admin can:

```text
[ CALL ]
[ MESSAGE ]
```

After contact, record:

```text
Contact Method
Reason
Remarks
Staff
Department
Date/Time
```

Never allow students or unauthorized users to access another student's guardian information.

---

# 16. Notifications

Student notifications:

- [ ] New violation
- [ ] Community service assigned
- [ ] Service reminder
- [ ] Time-In recorded
- [ ] Time-Out recorded
- [ ] Service completed
- [ ] Non-compliance notice
- [ ] Clearance status update

Staff notifications:

- [ ] New assigned service
- [ ] Non-compliant student
- [ ] Pending student action

---

# 17. Clearance and Good Standing

## Automatic Status Logic

```text
IF total violations = 0
    → GOOD_STANDING

ELSE IF pending violations = 0
    AND all required service completed
    → CLEARED

ELSE
    → NOT_CLEARED
```

Keep historical violations.

Do not delete violations after completion.

## Student Documents

Good standing student:

```text
CERTIFICATE OF GOOD DISCIPLINARY STANDING
```

Previously violated but completed:

```text
CERTIFICATE OF DISCIPLINARY CLEARANCE
```

Pending:

```text
NOT CLEARED
```

---

# 18. Enrollment Verification

Authorized enrollment personnel/professor should be able to view the student's disciplinary status.

Examples:

```text
GOOD DISCIPLINARY STANDING
```

or

```text
CLEARED FOR ENROLLMENT
```

or

```text
NOT CLEARED
Pending Community Service: 4 hours
```

Important: Only authorized users should have access to this information.

---

# 19. DO Admin Dashboard

Dashboard cards:

```text
Total Students
Active Violations
Pending Violations
Students on Community Service
Non-Compliant Students
Cleared Students
Good Standing Students
```

Main modules:

```text
Students
Violations
Community Service
DTR
Non-Compliance
Clearance
Notifications
Messages
Parent Contacts
Reports
```

---

# 20. Reports

Create:

- [ ] Violation report
- [ ] Community service report
- [ ] DTR report
- [ ] Non-compliance report
- [ ] Parent contact report
- [ ] Clearance report
- [ ] Good-standing report

Support:

- [ ] Search
- [ ] Filter
- [ ] Sort
- [ ] Print
- [ ] Export

---

# 21. Audit Logs

Record important actions:

```text
User
Action
Target
Target ID
Date/Time
IP Address
```

Examples:

```text
Department Head scanned student QR
DO Admin created violation
DO Admin issued clearance
Staff contacted parent
System Admin created account
```

---

# 22. Security Checklist

Before deployment:

- [ ] Password hashing
- [ ] Authentication
- [ ] Role-based authorization
- [ ] Backend permission checks
- [ ] Input validation
- [ ] SQL injection protection
- [ ] Rate limiting
- [ ] Secure authentication storage
- [ ] HTTPS
- [ ] CORS configuration
- [ ] QR validation
- [ ] Duplicate scan prevention
- [ ] Audit logs
- [ ] Database backups
- [ ] Session expiration
- [ ] Error handling without leaking secrets

Never rely only on frontend permission checks.

---

# 23. Testing Plan

## Student

- [ ] Login
- [ ] View profile
- [ ] View QR
- [ ] View violation
- [ ] View community service
- [ ] View DTR
- [ ] View notification
- [ ] View clearance
- [ ] Cannot access admin pages

## Department Head

- [ ] Login
- [ ] Scan QR
- [ ] Time-In
- [ ] Time-Out
- [ ] View DTR
- [ ] View assigned service
- [ ] View non-compliant students
- [ ] View authorized guardian contact
- [ ] Record parent contact
- [ ] Cannot access system-admin functions

## DO Admin

- [ ] Create violation
- [ ] Assign service
- [ ] Monitor DTR
- [ ] Monitor service
- [ ] Mark/review non-compliance
- [ ] Issue clearance
- [ ] Review parent contact logs
- [ ] Generate reports

## System Admin

- [ ] Create users
- [ ] Manage departments
- [ ] Manage roles
- [ ] View audit logs

---

# 24. Build Order — DO NOT SKIP AHEAD

Follow this exact order:

```text
1. Project Setup
        ↓
2. PostgreSQL Database
        ↓
3. Database Schema
        ↓
4. Express Backend
        ↓
5. Database Connection
        ↓
6. Authentication
        ↓
7. Role-Based Access
        ↓
8. React Frontend
        ↓
9. Login Page
        ↓
10. Student Dashboard
        ↓
11. Student Profile
        ↓
12. Student QR
        ↓
13. Department Dashboard
        ↓
14. QR Scanner
        ↓
15. Time-In
        ↓
16. Time-Out
        ↓
17. DTR Calculation
        ↓
18. Violation Management
        ↓
19. Community Service
        ↓
20. Automatic Progress
        ↓
21. Non-Compliance
        ↓
22. Parent/Guardian Contact
        ↓
23. Notifications
        ↓
24. DO Dashboard
        ↓
25. Clearance
        ↓
26. Good Standing
        ↓
27. Enrollment Verification
        ↓
28. Reports
        ↓
29. Audit Logs
        ↓
30. Security Testing
        ↓
31. Full Testing
        ↓
32. Production Deployment
```

---

# 25. Vibe Coding Rules

When using AI coding assistants, follow these rules:

### Rule 1 — One feature at a time

Do NOT ask the AI:

> "Build the entire STI Vio-Log system."

Instead:

> "Build the student authentication backend using the existing users table."

Then test it.

### Rule 2 — Don't let AI rewrite working code unnecessarily

Tell the AI:

> "Do not modify unrelated files or existing working features."

### Rule 3 — Always test after a change

```text
AI generates code
↓
Run application
↓
Test feature
↓
Fix errors
↓
Commit to Git
```

### Rule 4 — Give AI your project context

Keep this roadmap in the repository and provide it to your coding assistant when needed.

### Rule 5 — Never put secrets in code

Use:

```text
.env
```

for:

```text
DATABASE_URL
JWT_SECRET
API keys
```

---

# 26. First MVP Target

Do not try to finish everything immediately.

Your first working MVP should be:

```text
LOGIN
  ↓
STUDENT ACCOUNT
  ↓
STUDENT QR
  ↓
DEPARTMENT ACCOUNT
  ↓
QR SCANNER
  ↓
TIME-IN
  ↓
TIME-OUT
  ↓
DTR
  ↓
COMMUNITY SERVICE PROGRESS
```

After that works:

```text
VIOLATION
→ NON-COMPLIANCE
→ PARENT CONTACT
→ CLEARANCE
→ GOOD STANDING
→ ENROLLMENT VERIFICATION
```

Then add:

```text
NOTIFICATIONS
→ MESSAGES
→ REPORTS
→ AUDIT LOGS
→ SECURITY
→ DEPLOYMENT
```

---

# 27. Deferred Identity, Account, and eDTR Milestones

These requirements are recorded for future implementation. They are not part of the current username/password authentication flow and must not be considered complete until their backend, frontend, database, security, and integration tests pass.

## 27.1 Student Google Account Registration and Linking

- [x] Complete the security and API design in `docs/GOOGLE-IDENTITY-DESIGN.md` before implementation.

- [x] Allow a student to register or link a Google account through enrollment-gated verification.
- [x] Require the student to provide their own STI student number and full name during first-time linking.
- [x] Link existing school-managed records immediately and require authorized enrollment review for new identities.
- [x] Keep pending applicants outside the user/student tables and deny portal access until approval.
- [x] A student number already bound to an account cannot be registered again.
- [x] A Google identity already linked to one user cannot be linked to another student.
- [x] A student without a completed account link cannot use Google sign-in as an authenticated student.
- [x] After successful linking or approval, subsequent Google sign-ins resolve to the same student record.
- [x] Reject mismatched or conflicting identity combinations without exposing private student information.
- [x] Enforce pending and linked uniqueness with PostgreSQL constraints as well as application validation.
- [x] Record submission, approval, rejection, linking, and login security events in audit history.
- [ ] Define safe recovery and relinking procedures before allowing administrators to change a link.
- [x] Add concurrency tests proving that simultaneous pending registrations cannot claim the same Google identity.

## 27.2 Student eDTR Frontend

- [x] Build the authenticated student eDTR screen using the existing self-service DTR API.
- [x] Show only the signed-in student's sessions; never accept a client-selected student ID.
- [x] Display TIME_IN, TIME_OUT, actual worked minutes, credited minutes, assignment progress, and department.
- [x] Include loading, empty, error, active-session, date-filter, responsive, and accessible states.

## 27.3 Department and Staff Accounts

- [x] Define secure Google onboarding in `docs/DEPARTMENT-GOOGLE-IDENTITY-DESIGN.md` before implementation.
- [x] Provide separate Student and Department login/registration entry points with clearly different forms.
- [x] Allow an individual department officer to submit a Google-authenticated registration request.
- [x] Require officer first/last name, optional employee number, controlled department type, and requested official department name.
- [x] Support Library, School Guard, Staff Office, and Other as requested department types without hard-coding shared accounts.
- [x] Keep every request pending and deny all Department Head permissions until an Admin verifies the officer and department.
- [x] Require Admin approval/rejection with a reason; Discipline Office cannot grant staff roles or department scope.
- [x] During approval, map the officer to exactly one existing active department and create an individual `DEPARTMENT_HEAD` account.
- [x] Allow approved, active Department Heads to sign in with their own Google account.
- [x] Prevent one Google identity from registering as both a Student and Department Head or linking to multiple users.
- [ ] Preserve rejected registration history and audit submission, approval, rejection, linking, and login events.
- [ ] Keep department membership separate from application roles unless a department genuinely requires different permissions.
- [ ] Ensure Department-scoped accounts cannot scan for or report on another department.
- [x] Manage any optional password credential securely; Google-only officers receive no known/default password.
- [ ] Add concurrency and RBAC tests for duplicate officer, employee-number, Google-identity, and cross-role requests.

## 27.4 Discipline Office Accounts

- [ ] Provision two distinct Discipline Office user accounts because the school has two Discipline Officers.
- [ ] Give each officer an individual identity; do not share one account.
- [ ] Ensure audit records distinguish which officer performed each action.
- [ ] Provide secure initial-password delivery and forced password-change/account-recovery procedures.

## 27.5 Future Account Administration

- [x] Complete the security, credential-lifecycle, recovery, and API design in `docs/ACCOUNT-ADMINISTRATION-DESIGN.md` before implementation.
- [x] Add session-version invalidation, forced password-change enforcement, and recoverable Google-link schema foundations.
- [x] Add Admin-only transactional staff creation, activation/deactivation, role/department assignment, and password reset APIs.
- [x] Add the Admin-only individual staff account directory, creation, status, password-reset, and one-time-secret UI.
- [ ] Add authorized account creation, activation/deactivation, department assignment, and role management.
- [ ] Add audited account recovery and Google-link recovery.
- [ ] Add duplicate-account review tools without silently merging or deleting history.
- [ ] Revisit more granular staff roles only when their permissions differ from the existing RBAC model.

Recommended sequence:

```text
STUDENT SELF-SERVICE SCREENS
  -> STUDENT eDTR FRONTEND
  -> GOOGLE IDENTITY/LINKING DESIGN
  -> GOOGLE AUTHENTICATION IMPLEMENTATION
  -> SEPARATE STUDENT / DEPARTMENT AUTHENTICATION ENTRY POINTS
  -> GOOGLE DEPARTMENT REGISTRATION AND ADMIN APPROVAL
  -> ACCOUNT ADMINISTRATION AND RECOVERY
```

---

# 28. Definition of "Done"

The system is ready for deployment only when:

- [ ] All four roles work
- [ ] Authentication works
- [ ] Student Google identity linking prevents duplicate student and Google accounts
- [ ] Department Google registration requires Admin approval and prevents cross-role identity reuse
- [ ] Department/scanner officers are individually identified, Google-linked, and correctly scoped
- [ ] Both Discipline Officers have distinct audited accounts
- [ ] Database relationships work
- [ ] Student QR works
- [ ] Department QR scanning works
- [ ] Time-In works
- [ ] Time-Out works
- [ ] DTR calculates correctly
- [ ] Community service updates automatically
- [ ] Violations work
- [ ] Non-compliance works
- [ ] Parent contact works
- [ ] Contact logs work
- [ ] Notifications work
- [ ] Clearance works
- [ ] Good-standing status works
- [ ] Enrollment verification works
- [ ] Reports work
- [ ] Audit logs work
- [ ] Permissions are tested
- [ ] Mobile QR scanning works
- [ ] Production environment works
- [ ] Database backup strategy exists
- [ ] No critical security issues remain
