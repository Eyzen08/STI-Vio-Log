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
by the frontend. Authentication uses an opaque `HttpOnly` cookie plus a CSRF
token for mutations. Local storage contains only a non-secret user hint; startup
must restore and validate the cookie session before any protected screen renders.

## Verification

```powershell
npm run lint
npm test
npm run build
npm run audit:performance
```

Manually verify successful login, invalid credentials, logout, page refresh with
a valid session, and automatic rejection of an expired session.
