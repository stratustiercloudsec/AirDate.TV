// src/context/AuthContext.jsx
// Full auth: email/password, Google OAuth, token refresh, profile
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { COGNITO_CONFIG } from '@/config/aws'

const AuthContext = createContext(null)

// ── Cognito REST helpers ───────────────────────────────────────────────────
const IDP_ENDPOINT = `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`

async function cognitoReq(target, body) {
  const res = await fetch(IDP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-amz-json-1.1',
      'X-Amz-Target':  `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

// Token endpoint (for OAuth code exchange & refresh)
async function tokenReq(params) {
  const res = await fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: COGNITO_CONFIG.clientId,
      ...params,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

// ── JWT helpers ────────────────────────────────────────────────────────────
function parseJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch { return null }
}

function isExpired(token, bufferSecs = 60) {
  const c = parseJwt(token)
  if (!c?.exp) return true
  return Date.now() / 1000 > c.exp - bufferSecs
}

// ── Storage helpers ────────────────────────────────────────────────────────
const SKEY = 'airdate_session'
const save  = (s) => { try { localStorage.setItem(SKEY, JSON.stringify(s)) } catch {} }
const load  = ()  => { try { return JSON.parse(localStorage.getItem(SKEY) || 'null') } catch { return null } }
const clear = ()  => { try { localStorage.removeItem(SKEY) } catch {} }

// ── Build user profile from IdToken claims ─────────────────────────────────
function buildUser(idToken) {
  const c = parseJwt(idToken)
  if (!c) return null
  const groups = c['cognito:groups'] || []
  return {
    sub:       c.sub,
    email:     c.email,
    name:      c.name || c.email?.split('@')[0] || 'AirDate User',
    picture:   c.picture || null,
    tier:      c['custom:tier'] || (groups.includes('premium') ? 'premium' : 'free'),
    provider:  c.identities?.[0]?.providerName || 'Cognito',
    verified:  c.email_verified,
  }
}

// ── Google OAuth URL builder ───────────────────────────────────────────────
export function buildGoogleAuthUrl(state = '') {
  const params = new URLSearchParams({
    response_type:      'code',
    client_id:          COGNITO_CONFIG.clientId,
    redirect_uri:       COGNITO_CONFIG.redirectUri,
    identity_provider:  'Google',
    scope:              COGNITO_CONFIG.scopes,
    state:              state || window.location.pathname,
  })
  return `${COGNITO_CONFIG.domain}/oauth2/authorize?${params}`
}

// ── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(null)   // { AccessToken, IdToken, RefreshToken }
  const [user,     setUser]     = useState(null)
  const [loading,  setLoading]  = useState(true)

  const isAuthenticated = !!session?.AccessToken
  const isPremium       = user?.tier === 'premium'
  const token           = session?.AccessToken ?? null

  // Apply tokens to state
  function applySession(tokens) {
    setSession(tokens)
    setUser(buildUser(tokens.IdToken))
    save(tokens)
  }

  // Attempt refresh
  async function refresh(stored) {
    if (!stored?.RefreshToken) throw new Error('no refresh token')
    const data = await tokenReq({
      grant_type:    'refresh_token',
      refresh_token: stored.RefreshToken,
    })
    return {
      ...stored,
      AccessToken: data.access_token,
      IdToken:     data.id_token,
    }
  }

  // ── Restore session on mount ───────────────────────────────────────────
  useEffect(() => {
    async function restore() {
      const stored = load()
      if (!stored) { setLoading(false); return }

      if (stored.AccessToken && !isExpired(stored.AccessToken)) {
        applySession(stored)
        setLoading(false)
        return
      }
      try {
        const refreshed = await refresh(stored)
        applySession(refreshed)
      } catch {
        clear()
      }
      setLoading(false)
    }
    restore()
  }, [])

  // ── Proactive token refresh (every 15 min) ─────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(async () => {
      const stored = load()
      if (!stored || !stored.RefreshToken) return
      if (isExpired(stored.AccessToken, 300)) {   // refresh if < 5 min left
        try {
          const refreshed = await refresh(stored)
          applySession(refreshed)
        } catch {
          clear()
          setSession(null)
          setUser(null)
        }
      }
    }, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // ── Sign in with email/password ────────────────────────────────────────
  const signIn = useCallback(async (email, password) => {
    const data = await cognitoReq('InitiateAuth', {
      AuthFlow:       'USER_PASSWORD_AUTH',
      ClientId:       COGNITO_CONFIG.clientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
    if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return { challenge: 'NEW_PASSWORD_REQUIRED', session: data.Session }
    }
    const tokens = {
      AccessToken:  data.AuthenticationResult.AccessToken,
      IdToken:      data.AuthenticationResult.IdToken,
      RefreshToken: data.AuthenticationResult.RefreshToken,
    }
    applySession(tokens)
    return { success: true }
  }, [])

  // ── Exchange OAuth code for tokens (Google callback) ──────────────────
  const exchangeCode = useCallback(async (code) => {
    const data = await tokenReq({
      grant_type:   'authorization_code',
      code,
      redirect_uri: COGNITO_CONFIG.redirectUri,
    })
    const tokens = {
      AccessToken:  data.access_token,
      IdToken:      data.id_token,
      RefreshToken: data.refresh_token,
    }
    applySession(tokens)
    return { success: true }
  }, [])

  // ── Sign up ────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email, password, name) => {
    await cognitoReq('SignUp', {
      ClientId:       COGNITO_CONFIG.clientId,
      Username:       email,
      Password:       password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name',  Value: name || email.split('@')[0] },
      ],
    })
    return { success: true, needsVerification: true }
  }, [])

  // ── Confirm sign up ────────────────────────────────────────────────────
  const confirmSignUp = useCallback(async (email, code) => {
    await cognitoReq('ConfirmSignUp', {
      ClientId:         COGNITO_CONFIG.clientId,
      Username:         email,
      ConfirmationCode: code,
    })
    return { success: true }
  }, [])

  // ── Resend confirmation code ───────────────────────────────────────────
  const resendCode = useCallback(async (email) => {
    await cognitoReq('ResendConfirmationCode', {
      ClientId: COGNITO_CONFIG.clientId,
      Username: email,
    })
    return { success: true }
  }, [])

  // ── Forgot password ────────────────────────────────────────────────────
  const forgotPassword = useCallback(async (email) => {
    await cognitoReq('ForgotPassword', {
      ClientId: COGNITO_CONFIG.clientId,
      Username: email,
    })
    return { success: true }
  }, [])

  // ── Confirm forgot password ────────────────────────────────────────────
  const confirmForgotPassword = useCallback(async (email, code, newPassword) => {
    await cognitoReq('ConfirmForgotPassword', {
      ClientId:         COGNITO_CONFIG.clientId,
      Username:         email,
      ConfirmationCode: code,
      Password:         newPassword,
    })
    return { success: true }
  }, [])

  // ── Update profile attributes ──────────────────────────────────────────
  const updateProfile = useCallback(async (attributes) => {
    if (!session?.AccessToken) throw new Error('Not authenticated')
    const userAttributes = Object.entries(attributes).map(([Name, Value]) => ({ Name, Value }))
    await cognitoReq('UpdateUserAttributes', {
      AccessToken:    session.AccessToken,
      UserAttributes: userAttributes,
    })
    // Re-parse user from updated IdToken (name etc. won't reflect without re-auth,
    // so merge locally as optimistic update)
    setUser(prev => ({ ...prev, ...attributes }))
    return { success: true }
  }, [session])

  // ── Change password ────────────────────────────────────────────────────
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    if (!session?.AccessToken) throw new Error('Not authenticated')
    await cognitoReq('ChangePassword', {
      AccessToken:      session.AccessToken,
      PreviousPassword: oldPassword,
      ProposedPassword: newPassword,
    })
    return { success: true }
  }, [session])

  // ── Sign out ───────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (session?.AccessToken) {
      try { await cognitoReq('GlobalSignOut', { AccessToken: session.AccessToken }) } catch {}
    }
    clear()
    setSession(null)
    setUser(null)
  }, [session])

  return (
    <AuthContext.Provider value={{
      // State
      isAuthenticated, isPremium, token, user, loading,
      // Core auth
      signIn, signUp, confirmSignUp, resendCode,
      // Password flows
      forgotPassword, confirmForgotPassword, changePassword,
      // OAuth
      exchangeCode, buildGoogleAuthUrl,
      // Profile
      updateProfile,
      // Session
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>')
  return ctx
}