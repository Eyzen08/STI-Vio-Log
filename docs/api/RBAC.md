# Backend RBAC matrix

| Feature | ADMIN | DISCIPLINE_OFFICE | DEPARTMENT_HEAD | STUDENT |
|---|---:|---:|---:|---:|
| Student management / guardian fields | Yes | Yes | No | Own profile only |
| Violation create/read/update | Yes | Yes | No | Own read only |
| Violation lifecycle actions/history | Yes | Yes | No | Own violations only |
| Assignment management | Yes | Yes | Read | Own summary only |
| QR lookup | Yes | Yes | Own department | No |
| TIME_IN / TIME_OUT | Yes | Yes | Own department | No |
| DTR sessions | Broad | Broad | Own department | Own sessions only |
| Clearance management | Yes | Yes | Read/approve | Own read only |
| Staff reports | Yes | Yes | DTR for own department | No |
| Audit logs | Yes | Yes | No | No |

Department Head scope comes from the current database account mapping, never JWT claims or a client-selected department. ADMIN and DISCIPLINE_OFFICE must supply a valid department for attendance writes. Role checks return 403; absent/invalid authentication returns 401.
