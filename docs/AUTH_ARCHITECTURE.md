# LunaFlow Authentication Architecture

This document describes the persistent Google Drive authentication system implemented in LunaFlow.

## Core Components

### 1. Backend (Vercel Serverless Functions)

Located in `/api/auth/`, these functions handle the "secure" part of OAuth.

- **`/api/auth/login`**: Redirects the user to Google's OAuth consent screen with `access_type=offline` and `prompt=consent` to ensure a `refresh_token` is issued.
- **`/api/auth/callback`**: Receives the authorization code, exchanges it for tokens, and encrypts the `refresh_token` into a secure cookie.
- **`/api/auth/refresh`**: Decrypts the cookie and requests a new `access_token` from Google.
- **`/api/auth/logout`**: Destroys the secure session.

### 2. Session Management (`iron-session`)

We use `iron-session` to manage a stateless, encrypted, `HttpOnly` cookie named `lunaflow_auth_session`.

- **Security**: The `refresh_token` is never sent to the frontend. It stays encrypted in the cookie, protected from XSS.
- **Rolling Sessions**: The session is valid for 30 days. This timer is **reset** every time the user visits the app and a token refresh occurs (Scenario 2). This means the user only needs to re-authenticate if they are inactive for more than 30 consecutive days.

### 3. Frontend Service (`googleService.ts`)

- **`ensureValidToken()`**: A proactive interceptor that checks the token TTL before every Google Drive API call.
- **Proactive Refresh**: If the token is expired, it silently calls `/api/auth/refresh` to get a new one.

---

## Token Life Cycle & TTL Logic

To prevent race conditions and network latency issues, we implement a **Backend-Side Buffer**:

1. **Google Response**: Google returns an `access_token` with `expires_in: 3600` (1 hour).
2. **Backend Subtraction**: The Vercel API subtracts a **30-second safety buffer** (`3600 - 30 = 3570`).
3. **Frontend Calculation**: The frontend receives `expires_in: 3570` and calculates an absolute timestamp: `expiresAt = Date.now() + (3570 * 1000)`.
4. **Validation**: The frontend strictly checks `Date.now() >= expiresAt`. Because of the buffer, the token is refreshed ~30 seconds *before* Google actually invalidates it.

---

## Authentication Flows (Scenario Analysis)

### Scenario 1: First Login

1. User clicks "Sync".
2. **Redirect**: `Frontend` -> `/api/auth/login` -> `Google Auth`.
3. **Consent**: User clicks "Allow".
4. **Callback**: `Google` -> `/api/auth/callback?code=...`.
5. **Session**: Backend sets `HttpOnly` cookie with encrypted `refresh_token`.
6. **Return**: Backend redirects to `Frontend` with `access_token` and `expires_in` in the **URL Hash** (`/#access_token=...`).
7. **Hydration**: Frontend parses the hash, saves the token to `localStorage`, and scrubs the URL.

### Scenario 2: Background Refresh (Silent)

1. User interacts with the app (e.g., adds a record).
2. `googleService` triggers a sync.
3. `ensureValidToken()` detects `Date.now() >= expiresAt`.
4. **Refresh**: Frontend calls `fetch('/api/auth/refresh')`.
5. **Update**: Backend uses the cookie to get a new token, subtracts buffer, and returns it.
6. **Resume**: Frontend updates `localStorage` and continues the original Drive API call.

### Scenario 3: Session Expiration (> 30 days)

1. User returns after a long break.
2. `ensureValidToken()` triggers a refresh.
3. `/api/auth/refresh` returns `401 Unauthorized` because the cookie is missing or expired.
4. **Cleanup**: Frontend wipes `gapi` state **FIRST**, then `localStorage`.
5. **Prompt**: UI displays "Please reconnect Google Drive".

---

## Security Mandates for Future Edits

1. **NEVER** expose the `GOOGLE_CLIENT_SECRET` to the frontend.
2. **NEVER** pass the `refresh_token` to the frontend. It must remain in the `HttpOnly` cookie.
3. **NEVER** use absolute timestamps from the server for TTL; always use relative `expires_in` to account for client clock skew.
4. **ALWAYS** wipe the `gapi` memory state before clearing `localStorage` during logout to ensure a clean atomic transition.
5. **URL Hash**: Always pass the initial `access_token` via the URL hash fragment (`#`) to prevent it from being leaked to server logs or stored in browser history.
