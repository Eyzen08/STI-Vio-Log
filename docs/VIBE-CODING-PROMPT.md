# STI Vio-Log — Vibe Coding Master Prompt

You are helping develop **STI Vio-Log**, a production-ready web-based student disciplinary management system.

## Project Goal

Build a secure, maintainable web application for:

- Student violation monitoring
- Community service management
- Student QR codes
- Department QR scanning
- Time-In / Time-Out
- Digital DTR
- Multi-department monitoring
- Parent/guardian contact
- Non-compliance monitoring
- Notifications
- Student communication
- Clearance
- Good disciplinary standing
- Enrollment verification
- Reports
- Audit logs

## Technology

Frontend:
- React + Vite
- Tailwind CSS
- React Router
- Axios

Backend:
- Node.js
- Express
- PostgreSQL
- JWT authentication
- bcrypt

## Roles

- STUDENT
- DEPARTMENT_HEAD
- DO_ADMIN
- SYSTEM_ADMIN

## Important Development Rules

1. Work on ONE feature at a time.
2. Inspect the existing project before creating or changing files.
3. Do not rewrite unrelated working code.
4. Follow the existing project architecture.
5. Keep frontend and backend responsibilities separate.
6. Enforce authorization on the backend, not only in the frontend.
7. Never expose passwords, secrets, or sensitive data in QR codes.
8. Use environment variables for secrets.
9. Validate all important inputs.
10. Use parameterized database queries/ORM-safe queries.
11. Keep database relationships consistent.
12. Preserve historical violation records.
13. Add proper error handling.
14. Add loading and error states to frontend pages.
15. After each feature, explain how to test it.
16. Do not claim a feature is complete until it has been tested.
17. If a requested change conflicts with the existing architecture, explain the conflict before making destructive changes.
18. Prefer small, reviewable changes over huge generated files.

## Core Workflow

Student:
Login
→ View QR
→ Receive violation
→ Receive community service requirement
→ Attend service
→ Department scans QR
→ Time-In
→ Service
→ Time-Out
→ DTR calculated
→ Community service progress updated
→ Requirement completed

If overdue:
→ Non-compliance
→ Authorized staff can contact parent/guardian
→ Contact attempt is logged

At end of applicable academic period:
→ No violations = GOOD_STANDING
→ Completed violations = CLEARED
→ Unresolved requirement = NOT_CLEARED

## Current Development Phase

Before coding, ask yourself:

1. What phase of the roadmap are we currently implementing?
2. Which existing files are relevant?
3. Which database tables/API endpoints are needed?
4. What permissions are required?
5. How will this be tested?
6. What existing functionality could this change affect?

Implement only the requested phase/feature unless a dependency is necessary.

## First Priority

Build in this order:

1. Project setup
2. PostgreSQL database
3. Database schema
4. Express backend
5. Database connection
6. Authentication
7. Role-based authorization
8. React frontend
9. Login
10. Student dashboard
11. Student profile
12. Student QR
13. Department dashboard
14. QR scanner
15. Time-In
16. Time-Out
17. DTR calculation
18. Violation management
19. Community service
20. Automatic progress
21. Non-compliance
22. Parent/guardian contact
23. Notifications
24. DO dashboard
25. Clearance
26. Good standing
27. Enrollment verification
28. Reports
29. Audit logs
30. Security testing
31. Full testing
32. Deployment

## Response Format for Each Coding Task

When I give you a coding task:

### 1. Explain
Briefly explain what you will change.

### 2. Files
List files that will be created or modified.

### 3. Code
Provide complete code for the requested files or exact changes.

### 4. Commands
Give the exact terminal commands I need to run.

### 5. Test
Give step-by-step instructions to verify the feature.

### 6. Next Step
Tell me the next logical feature after the current feature works.

Do not skip testing.
