# Backend RBAC matrix

Reviewed October 10, 2026 against `backend/src/security/permissions.js`, server mounts, routes and controller ownership checks. These source permissions are separate from unperformed authenticated production acceptance. All active roles use `/login`, opaque cookies and CSRF; no client-selected role or bearer scope is accepted.

| Feature | DISCIPLINE_ADMIN | DISCIPLINE_OFFICE | DEPARTMENT_HEAD | STUDENT |
|---|---|---|---|---|
| Student management / guardian fields | Yes | Yes | Scoped minimal service identity, no guardian | Own profile only |
| Guardian-contact log | Yes | Yes | No | No |
| Violations and lifecycle actions | Yes | Yes | No (classification lookup has basic-view permission) | Own history via self-service |
| Assignment management | Yes | Yes | Scoped read only | Own summary |
| QR Time In/Out | Yes, valid department | Yes, valid department | Current authorized department | No |
| Active sessions / DTR | Broad | Broad | Scoped department | Own DTR |
| Reasoned hour corrections | Yes | Yes | No | No |
| Clearance/signatures/certificates | Manage/approve/issue | Manage/approve/issue | No | Own status/PDF/history |
| Messages | Yes | Yes | No | Own conversations |
| Staff reports / Excel exports | Yes | Yes | Scoped DTR/non-compliance API reads; no DATA_EXPORT | No |
| Audit/security/system monitoring | Yes | No | No | No |
| Staff / Department Accounts / departments / officer responsibilities | Yes | No | No | No |
| Historical Google registration / duplicate review | Yes | No | No | No |
| Protected system lock/recovery | Password-confirmed administrator | No | No | No |
| Own notifications/avatar | Yes | Yes | Yes | Yes |

`ADMIN` and `SYSTEM_ADMIN` survive only as historical enum labels; they authorize no current application permissions. Migration 037 merged System Administrator into Discipline Administrator. Interface labels such as Admin/DO Admin must not create additional roles.

Scope comes from current active database state, a non-revoked session and officer assignment, not stored JWT claims or client-selected departments. Account version changes revoke sessions through the database trigger; session rows contain no version snapshot. Scanner permissions and supervisor validity are rechecked in attendance transactions. Department Accounts have exactly STUDENT_BASIC_VIEW, ATTENDANCE_SCAN and DEPARTMENT_REPORT_VIEW. Guardian, private messages, clearance, audit and global directory remain denied.

Staff account creation requires STAFF_ACCOUNT_MANAGE and is administrator-only even where older route comments mention Discipline Office. Student provisioning/reset/corrections are operational staff actions. `DELETE /api/students/:id` also currently permits both operational staff roles and attempts a physical delete; it is not an administrator-only soft deactivation workflow. See the retention finding in [the audit](../AUDIT-REPORT.md).

Department DTR/non-compliance APIs enforce department scope; some old report page URLs redirect to the department dashboard. Authorized local CSV helpers operate only on scoped loaded data, while server Excel exports require DATA_EXPORT and are denied to departments. Student self-service derives the linked student from `req.user.id` and accepts no ownership override. Role denial is 403; missing/invalid session is 401; private non-visible records generally return 404. Forced password change/onboarding further restrict access.

See [API contracts](CONTRACTS.md), [academic model](../STUDENT-ACADEMIC-MODEL.md), [administrator security](../administrator-security-model.md) and [testing](../TESTING.md).
