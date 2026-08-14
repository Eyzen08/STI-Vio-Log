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

## Department Head

1. Department Head can authenticate securely.
2. Department Head can only access authorized department functions.
3. Department Head can scan student QR codes.
4. Department Head can record student Time-In.
5. Department Head can record student Time-Out.
6. System records the department and staff member responsible for the scan.
7. Department Head can view authorized student/service records.
8. Department Head can identify non-compliant students.
9. Department Head can access authorized parent/guardian contact information.
10. Department Head can initiate a call/message action using the stored contact information.
11. Department Head can record contact attempts and remarks.

## Disciplinary Office

1. DO Admin can create and manage violations.
2. DO Admin can assign community service.
3. System can calculate service progress.
4. DO Admin can monitor DTR.
5. DO Admin can monitor non-compliance.
6. DO Admin can review parent contact logs.
7. DO Admin can manage disciplinary clearance.
8. DO Admin can review reports.
9. DO Admin can communicate with students.

## System Administration

1. System Admin can manage accounts.
2. System Admin can manage departments.
3. System Admin can manage roles and permissions.
4. System Admin can review audit logs.

## Clearance

1. Student with no applicable recorded violations can be classified as GOOD_STANDING.
2. Student with completed disciplinary requirements can be classified as CLEARED.
3. Student with unresolved requirements must remain NOT_CLEARED.
4. Historical violations must not be deleted simply because they are completed.
5. Clearance status must be determined by backend rules.
6. Only authorized users can issue/finalize clearance.
