// src/config/aws.js
const hostname = window.location.hostname

// FIX 1: Extended isDev to cover all three test environments:
//   - http://stage.s3.airdate.tv.s3-website-us-east-1.amazonaws.com  → S3 staging
//   - https://main.d2l7c6jhjkopde.amplifyapp.com                     → Amplify preview
//   - http://44.200.161.202:5173                                       → EC2 raw IP
const isDev =
  hostname === 'dev.airdate.tv'                               ||
  hostname === 'localhost'                                    ||
  hostname.match(/^\d+\.\d+\.\d+\.\d+$/)                    || // any raw IP (EC2)
  hostname.endsWith('.amplifyapp.com')                       || // Amplify preview URLs
  hostname.endsWith('.s3-website-us-east-1.amazonaws.com')  || // S3 static staging
  hostname.endsWith('.s3-website.us-east-1.amazonaws.com')     // S3 alt region format

// FIX 2: redirectSignIn must point to /auth/callback — not to root /
// Root redirect means Cognito sends the ?code= to HomePage which has no
// handler for it, so the OAuth exchange never completes.
const devRedirect  = hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)
  ? `http://${hostname}:5173/auth/callback`   // local/EC2 — http is fine for non-Cognito-hosted
  : `https://dev.airdate.tv/auth/callback`    // S3/Amplify staging — route through dev subdomain

export const AWS_CONFIG = {
  cognito: {
    region:           'us-east-1',
    userPoolId:       isDev ? 'us-east-1_LIdVq7KLY'         : 'us-east-1_J62LRXqEx',
    userPoolClientId: isDev ? '5jhemhkb9fckdrh9ppidp7260e'  : '3e6kan59l4fij8rrq5rqttsmcl',
    authDomain:       isDev ? 'auth.dev.airdate.tv'          : 'auth.airdate.tv',
    // FIX 2: was 'https://dev.airdate.tv/' — now points to /auth/callback
    redirectSignIn:   isDev ? devRedirect                    : 'https://airdate.tv/auth/callback',
    redirectSignOut:  isDev ? 'https://dev.airdate.tv/'      : 'https://airdate.tv/',
  },
  apiGateway: {
    baseUrl: 'https://21ave5trw7.execute-api.us-east-1.amazonaws.com',
  },
  stripe: {
    publishableKey: isDev
      ? 'pk_test_51IMMaBBjDtVyDmuWzlTaUqYPa1oDqTmwdDXwAuMzQgpryK44RgvmxhDQBFwmE9MQIrwKRxo0yQVdf7stj662Qa4d00cRzkFdtZ'
      : 'pk_live_51IMMaBBjDtVyDmuWpRo4DtQwWCayvCBUMxwdboKmjbkQl0TAc3iK4ufEj9qzS1chTRhSVH4A0cs0hbICLEfFXNAI00UQPLJbVu',
    priceIdMonthly: isDev ? 'price_1TLThmPnMd1p8PBVSNGRgLNl' : 'price_1TLTjOBjDtVyDmuWCzaTYd7E',
    priceIdAnnual:  isDev ? 'price_1TLTxfPnMd1p8PBVTPXH22fZ' : 'price_1TLTz2BjDtVyDmuWJskKceUT',
  },
}

export const API_BASE   = AWS_CONFIG.apiGateway.baseUrl
export const USER_API   = API_BASE
export const IMAGE_BASE = 'https://dmg16wbx5pi4h.cloudfront.net'
export const IS_DEV     = isDev

// ── COGNITO_CONFIG alias (used by AuthContext) ─────────────────────────────
// AuthContext.jsx references COGNITO_CONFIG directly, so we export it
// in the shape it expects.
export const COGNITO_CONFIG = {
  region:      AWS_CONFIG.cognito.region,
  userPoolId:  AWS_CONFIG.cognito.userPoolId,
  clientId:    AWS_CONFIG.cognito.userPoolClientId,
  domain:      `https://${AWS_CONFIG.cognito.authDomain}`,
  redirectUri: AWS_CONFIG.cognito.redirectSignIn,
  scopes:      'email openid profile',
}