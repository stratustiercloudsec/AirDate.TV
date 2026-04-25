// src/config/aws.js
const hostname = window.location.hostname
const origin   = window.location.origin   // e.g. https://main.d2l7c6jhjkopde.amplifyapp.com

const isDev =
  hostname === 'dev.airdate.tv'                               ||
  hostname === 'localhost'                                    ||
  hostname.match(/^\d+\.\d+\.\d+\.\d+$/)                    || // any raw IP (EC2)
  hostname.endsWith('.amplifyapp.com')                       || // Amplify preview URLs
  hostname.endsWith('.s3-website-us-east-1.amazonaws.com')  || // S3 static staging
  hostname.endsWith('.s3-website.us-east-1.amazonaws.com')     // S3 alt region format

// Dynamic redirect URI — always uses the ACTUAL current origin so Cognito
// sends the auth code back to wherever the app is currently running.
// Each origin must be registered in the Cognito App Client's allowed callback URLs.
const devRedirect = `${origin}/auth/callback`

export const AWS_CONFIG = {
  cognito: {
    region:           'us-east-1',
    userPoolId:       isDev ? 'us-east-1_LIdVq7KLY'         : 'us-east-1_J62LRXqEx',
    userPoolClientId: isDev ? '5jhemhkb9fckdrh9ppidp7260e'  : '3e6kan59l4fij8rrq5rqttsmcl',
    authDomain:       isDev ? 'auth.dev.airdate.tv'          : 'auth.airdate.tv',
    redirectSignIn:   isDev ? devRedirect                    : 'https://airdate.tv/auth/callback',
    redirectSignOut:  isDev ? `${origin}/`                   : 'https://airdate.tv/',
  },
  apiGateway: {
    baseUrl: 'https://21ave5trw7.execute-api.us-east-1.amazonaws.com',
    checkoutUrl: 'https://hazl8ggqu3.execute-api.us-east-1.amazonaws.com/prod',
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

export const COGNITO_CONFIG = {
  region:      AWS_CONFIG.cognito.region,
  userPoolId:  AWS_CONFIG.cognito.userPoolId,
  clientId:    AWS_CONFIG.cognito.userPoolClientId,
  domain:      `https://${AWS_CONFIG.cognito.authDomain}`,
  redirectUri: AWS_CONFIG.cognito.redirectSignIn,
  scopes:      'email openid profile',
}

// src/config/aws.js — add this line
export const SCOOP_MANIFEST_URL = 'https://airdate.tv/scoop/stories.json'