# STI Vio-Log frontend

React and Vite client for the STI Vio-Log discipline portal.

## Local setup

1. Copy `.env.example` to `.env` and set `VITE_API_URL` to the backend origin.
2. Start the backend on the configured origin.
3. Install and run the frontend:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Sign in with an active account created in the
backend database. Credentials are sent only to the login API and are never stored
by the frontend. The JWT and public user identity persist in local storage until
logout or token expiry.

## Verification

```powershell
npm run lint
npm test
npm run build
```

Manually verify successful login, invalid credentials, logout, page refresh with
a valid session, and automatic rejection of an expired session.
