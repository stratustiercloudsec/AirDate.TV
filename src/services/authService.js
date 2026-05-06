// src/services/authService.js
// Thin wrapper around Amplify Auth — keeps Cognito calls out of components

import { Amplify } from 'aws-amplify'
import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
  signInWithRedirect,   // ← replaces old login() global / oidc-client-ts redirect
} from 'aws-amplify/auth'
import { AWS_CONFIG } from '@/config/aws'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: AWS_CONFIG.cognito.userPoolId,
      userPoolClientId: AWS_CONFIG.cognito.userPoolClientId,
      loginWith: {
        oauth: {
          domain: AWS_CONFIG.cognito.authDomain,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [AWS_CONFIG.cognito.redirectSignIn],
          redirectSignOut: [AWS_CONFIG.cognito.redirectSignOut],
          responseType: 'code',
        },
      },
    },
  },
})

/**
 * Returns the current authenticated user + JWT token, or null if unauthenticated.
 */
export async function getSession() {
  try {
    const user = await getCurrentUser()
    const session = await fetchAuthSession()
    const token = session.tokens?.idToken?.toString()
    return { user, token }
  } catch {
    return null
  }
}

export async function login(email, password) {
  return signIn({ username: email, password })
}

export async function logout() {
  return signOut()
}

export async function register(email, password) {
  return signUp({ username: email, password, options: { userAttributes: { email } } })
}

export async function confirmRegistration(email, code) {
  return confirmSignUp({ username: email, confirmationCode: code })
}

export async function forgotPassword(email) {
  return resetPassword({ username: email })
}

export async function confirmForgotPassword(email, code, newPassword) {
  return confirmResetPassword({ username: email, confirmationCode: code, newPassword })
}

/**
 * Returns a valid Bearer token for Lambda calls, refreshing if needed.
 */
export async function getBearerToken() {
  const session = await fetchAuthSession({ forceRefresh: false })
  return session.tokens?.idToken?.toString() ?? null
}

/**
 * Triggers the Cognito Hosted UI redirect — replaces the old global login() from auth.js.
 * This is what the "Sign In" button in Navbar should call for unauthenticated users.
 * After the user authenticates, Cognito redirects back to /callback.
 */
export async function loginWithHostedUI() {
  return signInWithRedirect()
}
