# STI Vio-Log — Functional Requirements

## Student

1. Student can authenticate securely.
2. Student can view their own profile.
3. Student has a unique QR code.
4. Student can view recorded violations.
5. Student can view community-service requirements.
6. Student can view completed and remaining hours.
7. Student can view DTR records.
8. Student receives relevant notifications.
9. Student can communicate with authorized school personnel.
10. Student can view disciplinary clearance status.
11. Eligible students can view/download the applicable certificate.

## Department Account

1. A Department Account can authenticate using the username and temporary password issued by the Discipline Office/Admin.
2. The account must change its temporary password at first sign-in.
3. A Department Account can access only assignments owned by its authenticated department.
4. A Department Account can scan student QR codes for its assigned community-service records.
5. A Department Account can record student Time-In and Time-Out without a second Discipline Office approval.
6. The system calculates worked time from server timestamps and credits no more than the remaining required hours.
7. A Department Account can monitor its currently active students and live elapsed service time.
8. A Department Account can record the student's service condition and an optional result note at Time-Out.
9. A Department Account can view only the student/service details necessary for its assigned work.
10. A Department Account cannot decide required hours, approve clearance, access student messages, or view parent/guardian contact information.
11. Department A cannot view, scan, update, or export Department B's assignments.

## Disciplinary Office

1. DO Admin can create and manage violations.
2. DO Admin can assign community service.
3. DO Admin decides required service hours separately from the violation and assigns the student to a department.
4. System calculates service progress from credited Department Time-In/Time-Out sessions.
5. DO Admin can monitor DTR.
6. DO Admin can monitor non-compliance.
7. DO Admin can access guardian details, manually contact the guardian, and append a contact-attempt log.
8. DO Admin can manage disciplinary clearance.
9. DO Admin can review reports.
10. DO Admin can communicate with students.

## System Administration

1. System Admin can manage Student and Department Accounts, including password reset, deactivation/deletion, and Google-link revocation where applicable.
2. System Admin can manage departments.
3. System Admin can manage roles and permissions.
4. System Admin can review audit logs.

## Reports and exports

1. Admin and Discipline Office can generate violation, community-service, DTR, non-compliance, guardian-contact, clearance, and good-standing reports.
2. Report filters and sorting values must be validated by the backend.
3. Reports and CSV exports must use student-facing references such as Student Number and must omit raw internal database IDs, credentials, tokens, and guardian phone numbers.
4. Violation reports must not assign or display legacy violation service hours; community-service reports are the authoritative source for required, completed, and remaining hours.
5. Invalid or cancelled violations do not change an otherwise eligible student from GOOD_STANDING to CLEARED.

## Clearance

1. Student with no applicable recorded violations can be classified as GOOD_STANDING.
2. Student with completed disciplinary requirements can be classified as CLEARED.
3. Student with unresolved requirements must remain NOT_CLEARED.
4. Historical violations must not be deleted simply because they are completed.
5. Clearance status must be determined by backend rules.
6. Only authorized users can issue/finalize clearance.

## Real-time updates and recovery

1. Authenticated students and Discipline Office/Admin users receive message refresh events only for conversations they are authorized to access.
2. Department Accounts receive attendance refresh events only for their authenticated department.
3. Real-time events contain refresh identifiers rather than private record contents.
4. REST endpoints remain authoritative, and periodic polling recovers state after a connection interruption.
