# STI Vio-Log frontend

React and Vite frontend for STI College Global City, serving College and Senior High School students under the same Student role and authorization rules.

## Academic information

| Mode | Required academic fields |
| --- | --- |
| College | Existing approved program, year 1-4, section |
| Senior High School | ABM or STEM strand, Grade 11 or 12, section |

ABM means Accountancy, Business, and Management. STEM means Science, Technology, Engineering, and Mathematics. Onboarding and audited staff edits use mode-specific controls. Profiles, search, QR verification, and applicable reports use Program/Strand and Year/Grade labels. Historical values and issued certificate snapshots remain preserved.

See the [student academic model](../docs/STUDENT-ACADEMIC-MODEL.md) for API fields, legacy behavior, registration-service compatibility, and release acceptance. New student accounts are issued by the Discipline Office; public self-registration remains retired.

## Development and checks

Use the Node/npm versions declared in package.json. From this directory:

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

On other shells, `npm` can replace `npm.cmd`. Local configuration examples are in .env.example. Never expose backend credentials with a VITE_ prefix.

## Production

The Vercel frontend uses a same-origin API proxy configured by server-side `API_PROXY_ORIGIN`. Set `VITE_GOOGLE_CLIENT_ID` for Google identity. Apply backend migration 043 and deploy the compatible API before deploying this frontend. Verify College, ABM Grade 11, and STEM Grade 12 with test accounts. See [production deployment](../docs/PRODUCTION-DEPLOYMENT.md).
