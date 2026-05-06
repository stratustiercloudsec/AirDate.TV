# AirDate.tv — React Migration

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # outputs to /dist
```

## Project Structure

```
src/
├── config/
│   └── aws.js                  # Cognito + API Gateway constants
├── services/
│   └── authService.js          # All Amplify Auth calls (signIn, signOut, token)
├── context/
│   ├── AuthContext.jsx          # Global auth state — useAuth()
│   ├── WatchlistContext.jsx     # Replaces pulse.js — useWatchlist()
│   └── NotificationContext.jsx  # Bell dropdown state — useNotifications()
├── components/
│   ├── layout/
│   │   └── Navbar.jsx           # Single navbar for all pages
│   └── guards/
│       └── index.jsx            # ProtectedRoute + FreemiumGate
├── pages/
│   ├── HomePage.jsx             # Example — shows hook usage
│   └── ...                      # Port remaining 9 pages here
└── App.jsx                      # Providers + React Router routes
```

## Key Hooks

### useAuth()
```js
const { user, token, isAuthenticated, isPremium, logout } = useAuth()
```

### useWatchlist()
```js
const { watchlist, toggleWatchlist, isTracked, atLimit, freemiumLimit } = useWatchlist()

// Adding a show (handles freemium gate)
const result = toggleWatchlist(show)
if (result?.error === 'FREEMIUM_LIMIT') { /* show upgrade prompt */ }
```

### useNotifications()
```js
const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
```

## Deployment

1. Create new Amplify app → connect repo → use `amplify.yml`
2. Set env var `VITE_ENV=production` in Amplify console
3. Point `beta.airdate.tv` to Amplify domain for staging
4. Cut over `airdate.tv` CloudFront after smoke test
5. Decommission EC2

## Environment Variables

Create `.env.local` for local dev:
```
VITE_ENV=development
```
AWS config lives in `src/config/aws.js` — no secrets in env vars needed
since Cognito public client IDs are safe to expose.
