// src/config/aws.js
const hostname = window.location.hostname
const isDev = hostname === 'dev.airdate.tv'
          || hostname === 'localhost'
          || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)

export const AWS_CONFIG = {
  cognito: {
    region:           'us-east-1',
    userPoolId:       isDev ? 'us-east-1_LIdVq7KLY'        : 'us-east-1_J62LRXqEx',
    userPoolClientId: isDev ? '5jhemhkb9fckdrh9ppidp7260e' : '3e6kan59l4fij8rrq5rqttsmcl',
    authDomain:       isDev ? 'auth.dev.airdate.tv'         : 'auth.airdate.tv',
    redirectSignIn:   isDev ? 'https://dev.airdate.tv/'     : 'https://airdate.tv/',
    redirectSignOut:  isDev ? 'https://dev.airdate.tv/'     : 'https://airdate.tv/',
  },
  apiGateway: {
    // Both main content + user data live on the same gateway
    baseUrl: 'https://21ave5trw7.execute-api.us-east-1.amazonaws.com',
  },
  stripe: {
    publishableKey:  isDev
      ? 'pk_test_51IMMaBBjDtVyDmuWzlTaUqYPa1oDqTmwdDXwAuMzQgpryK44RgvmxhDQBFwmE9MQIrwKRxo0yQVdf7stj662Qa4d00cRzkFdtZ'
      : 'pk_live_51IMMaBBjDtVyDmuWpRo4DtQwWCayvCBUMxwdboKmjbkQl0TAc3iK4ufEj9qzS1chTRhSVH4A0cs0hbICLEfFXNAI00UQPLJbVu',
    priceIdMonthly:  isDev ? 'price_1TLThmPnMd1p8PBVSNGRgLNl' : 'price_1TLTjOBjDtVyDmuWCzaTYd7E',
    priceIdAnnual:   isDev ? 'price_1TLTxfPnMd1p8PBVTPXH22fZ' : 'price_1TLTz2BjDtVyDmuWJskKceUT',
  },
}

// In dev (localhost / IP), route through Vite's proxy to avoid CORS.
// In production, hit the API Gateway directly.
export const API_BASE = isDev
  ? '/api'
  : AWS_CONFIG.apiGateway.baseUrl

export const USER_API = API_BASE                         // same gateway
export const IS_DEV   = isDev

// Image CDN: use CloudFront in production (pre-warmed cache), fall back to
// TMDB origin in dev so every poster is always available regardless of cache state.
export const IMAGE_BASE = isDev
  ? 'https://image.tmdb.org'
  : 'https://dmg16wbx5pi4h.cloudfront.net'
