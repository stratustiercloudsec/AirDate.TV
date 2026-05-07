// public/sw.js
// AirDate Service Worker — handles push notifications and notification clicks.
// Deployed to /sw.js at the site root so its scope covers the full origin.

const CACHE_VERSION = 'airdate-v1'

// ── Push event ───────────────────────────────────────────────────────────────
// Payload shape sent by airdate-push-notifications Lambda:
// { title, body, icon, badge, url, tag }
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'AirDate', body: event.data?.text() ?? 'You have a new alert.' }
  }

  const {
    title  = 'AirDate',
    body   = 'A show in your watchlist is premiering soon.',
    icon   = '/assets/images/favicon-32x32.png',
    badge  = '/assets/images/favicon-32x32.png',
    url    = '/notifications',
    tag    = 'airdate-alert',
  } = data

  const options = {
    body,
    icon,
    badge,
    tag,                   // Collapses duplicate alerts with same tag
    renotify:  false,      // Don't vibrate again if tag matches an existing notification
    requireInteraction: false,
    data: { url },         // Passed through to notificationclick
    actions: [
      { action: 'view',    title: '📺 View Shows' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})


// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url ?? '/notifications'
  const fullUrl   = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing tab if already open
      for (const client of clientList) {
        const clientUrl = new URL(client.url)
        if (clientUrl.origin === self.location.origin) {
          client.focus()
          client.navigate(fullUrl)
          return
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(fullUrl)
    })
  )
})


// ── Install / activate ────────────────────────────────────────────────────────
// Minimal lifecycle — no offline caching needed; this SW is push-only.
self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim())
})
