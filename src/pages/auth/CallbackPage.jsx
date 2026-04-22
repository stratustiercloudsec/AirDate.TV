// src/pages/auth/CallbackPage.jsx
// Handles the Cognito OAuth redirect after Google sign-in.
//
// FIX: Original version used Amplify's getSession() from authService.
// That creates a parallel session that AuthContext knows nothing about —
// so the user would appear signed out on every other page.
// This version calls exchangeCode() from AuthContext, which stores
// tokens in localStorage under 'airdate_session' — the same key
// all other auth flows use.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function CallbackPage() {
  const { exchangeCode } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)  // React StrictMode guard — prevents double-execution

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
        // No code in URL — user may have landed here directly
        navigate('/auth/login', { replace: true })
        return
      }

      try {
        await exchangeCode(code)
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
        <p className="text-slate-500 text-xs">Just a moment…</p>
      </div>
    </div>
  )
}