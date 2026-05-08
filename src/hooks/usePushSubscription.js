// src/hooks/usePushSubscription.js
//
// Handles the full push subscription lifecycle:
//   1. Register sw.js
//   2. Request Notification permission
//   3. Subscribe via PushManager using VAPID public key
//   4. Save the PushSubscription object to airdate-users via the user-data Lambda
//
// USAGE — call subscribeToPush() from any UI action (bell button, account preferences):
//
//   const { isSubscribed, isSupported, subscribeToPush, unsubscribeFromPush } = usePushSubscription()

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'

// Set in .env: VITE_VAPID_PUBLIC_KEY=<your base64url public key>
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

// urlBase64ToUint8Array — required by PushManager.subscribe()
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function getUserSub(user) {
  return user?.sub ?? user?.userId ?? user?.username ?? ''
}

export function usePushSubscription() {
  const { token, user, isAuthenticated } = useAuth()
  const [isSubscribed,  setIsSubscribed]  = useState(false)
  const [isSupported,   setIsSupported]   = useState(false)
  const [swReg,         setSwReg]         = useState(null)
  const [permissionState, setPermissionState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  // ── Check support + existing subscription on mount ───────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsSupported(false)
      return
    }
    setIsSupported(true)

    navigator.serviceWorker
      .register(`${API_BASE}/sw.js`, { scope: '/' })
      .then(async reg => {
        setSwReg(reg)
        const existing = await reg.pushManager.getSubscription()
        setIsSubscribed(!!existing)
        if (typeof Notification !== 'undefined') {
          setPermissionState(Notification.permission)
        }
      })
      .catch(err => console.warn('[AirDate SW] Registration failed:', err))
  }, [])

  // ── Save subscription to DynamoDB via airdate-user-data Lambda ───────────
  // Route: PUT /user/{sub}/push-subscription
  // Body:  { subscription: PushSubscriptionJSON }
  const saveSubscription = useCallback(async (subscription) => {
    const sub = getUserSub(user)
    if (!token || !sub) return
    try {
      await fetch(`${API_BASE}/user/${sub}/push-subscription`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
    } catch (e) {
      console.warn('[AirDate SW] Failed to save subscription:', e)
    }
  }, [token, user?.sub, user?.userId, user?.username])

  // ── Remove subscription from DynamoDB ───────────────────────────────────
  const removeSubscription = useCallback(async () => {
    const sub = getUserSub(user)
    if (!token || !sub) return
    try {
      await fetch(`${API_BASE}/user/${sub}/push-subscription`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {}
  }, [token, user?.sub, user?.userId, user?.username])

  // ── Subscribe ────────────────────────────────────────────────────────────
  const subscribeToPush = useCallback(async () => {
    if (!isSupported || !isAuthenticated) return { success: false, reason: 'unsupported' }

    let reg = swReg
    if (!reg) {
      try {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        setSwReg(reg)
      } catch (e) {
        return { success: false, reason: 'sw_registration_failed' }
      }
    }

    // Request permission
    const permission = await Notification.requestPermission()
    setPermissionState(permission)
    if (permission !== 'granted') {
      return { success: false, reason: 'permission_denied' }
    }

    try {
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      setIsSubscribed(true)
      await saveSubscription(subscription)
      return { success: true }
    } catch (e) {
      console.warn('[AirDate SW] Subscribe failed:', e)
      return { success: false, reason: 'subscribe_failed' }
    }
  }, [isSupported, isAuthenticated, swReg, saveSubscription])

  // ── Unsubscribe ──────────────────────────────────────────────────────────
  const unsubscribeFromPush = useCallback(async () => {
    if (!swReg) return
    try {
      const existing = await swReg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      setIsSubscribed(false)
      await removeSubscription()
    } catch (e) {
      console.warn('[AirDate SW] Unsubscribe failed:', e)
    }
  }, [swReg, removeSubscription])

  return {
    isSupported,
    isSubscribed,
    permissionState,   // 'default' | 'granted' | 'denied'
    subscribeToPush,
    unsubscribeFromPush,
  }
}
