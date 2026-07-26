// src/pages/auth/CallbackPage.jsx
// Handles the Cognito OAuth redirect after Google sign-in.
//
// FIX: Original version used Amplify's getSession() from authService.
// That creates a parallel session that AuthContext knows nothing about -
// so the user would appear signed out on every other page.
// This version calls exchangeCode() from AuthContext, which stores
// tokens in localStorage under 'airdate_session' - the same key
// all other auth flows use.
//
// FIX 2: Google sign-ups never fired the mailing-list /subscribe call, because
// the opt-in checkbox on SignUpPage.jsx only lived inside the email/password
// form's onSubmit handler. The Google button does a full-page redirect to
// Google/Cognito, which wipes React state entirely - so subscribeToList was
// never seen by anything after the redirect. SignUpPage.jsx now stashes the
// user's choice in sessionStorage before redirecting; this component reads it
// back here, once the post-OAuth session exists and we can get the user's
// email from the freshly-issued ID token.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'

// JWTs use base64url encoding (- and _ instead of + and /, no padding).
// atob() only understands standard base64, so this normalizes first.
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch (e) {
    console.error('Failed to decode ID token payload:', e)
    return null
  }
}

function getStoredEmail() {
  try {
    const session = JSON.parse(localStorage.getItem('airdate_session') || '{}')
    const idToken =
      session?.tokens?.idToken?.toString?.() ||
      session?.idToken?.jwtToken ||
      session?.idToken ||
      ''
    if (!idToken) return null
    const payload = decodeJwtPayload(idToken)
    return payload?.email || null
  } catch (e) {
    console.error('Failed to read stored session for email:', e)
    return null
  }
}

function maybeFireSubscribe() {
  const wantsSubscribe = sessionStorage.getItem('airdate_pending_subscribe') === 'true'
  // Always clear the flag once read, whether or not we succeed, so a stale
  // value can never cause a duplicate/incorrect subscribe on a later sign-in.
  sessionStorage.removeItem('airdate_pending_subscribe')
  if (!wantsSubscribe) return

  const email = getStoredEmail()
  if (!email) {
    console.error('Mailing-list opt-in was set but no email could be read from the new session - skipping /subscribe call.')
    return
  }

  // Fire-and-forget, matching the email/password path's behavior in
  // SignUpPage.jsx - mailing list opt-in should never block or fail sign-in.
  fetch(`${API_BASE}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase(), source: 'signup-page-google' }),
  }).catch(() => {})
}

export function CallbackPage() {
  const { exchangeCode } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)  // React StrictMode guard - prevents double-execution

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    async function handle() {
      const params = new URLSearchParams(window.location.search)
      const code   = params.get('code')
      const state  = params.get('state')   // the 'from' path passed in buildGoogleAuthUrl()
      const error  = params.get('error')

      if (error) {
        console.error('OAuth error from Cognito:', error)
        navigate('/auth/login?error=oauth_denied', { replace: true })
        return
      }

      if (!code) {
        // No code in URL - user may have landed here directly
        navigate('/auth/login', { replace: true })
        return
      }

      try {
        await exchangeCode(code)

        // Mailing-list opt-in from SignUpPage's Google button, if any.
        // Must run AFTER exchangeCode() resolves, since that's what writes
        // the ID token to localStorage that getStoredEmail() reads from.
        maybeFireSubscribe()

        // Redirect to the page the user originally wanted, or home
        const dest =
          state && state.startsWith('/') && !state.startsWith('/auth')
            ? state
            : '/'
        navigate(dest, { replace: true })
      } catch (err) {
        console.error('OAuth code exchange failed:', err)
        navigate('/auth/login?error=oauth_failed', { replace: true })
      }
    }

    handle()
  }, [])

  return (
    <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center gap-5">
      <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"/>
      <div className="text-center">
        <p className="text-white font-bold text-sm uppercase tracking-widest mb-1">
          Signing you in
        </p>
        <p className="text-slate-200 text-xs">Just a moment...</p>
      </div>
    </div>
  )
}