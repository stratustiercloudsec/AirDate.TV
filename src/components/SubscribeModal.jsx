import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/config/aws'
import { useAuth } from '@/context/AuthContext'

const SEEN_KEY = 'airdate_subscribe_dismissed'
const SUBSCRIBED_KEY = 'airdate_subscribed'
const SHOW_DELAY_MS = 2500

export default function SubscribeModal() {
  const { isAuthenticated, loading } = useAuth()
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success

  useEffect(() => {
    if (loading) return                                    // wait for auth check
    if (isAuthenticated) return                            // signed-in users are already subscribed
    if (localStorage.getItem(SUBSCRIBED_KEY)) return       // subscribed previously on this device
    if (localStorage.getItem(SEEN_KEY)) return             // dismissed previously — don't nag
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [loading, isAuthenticated])

  const dismiss = useCallback(() => {
    localStorage.setItem(SEEN_KEY, '1')
    setVisible(false)
  }, [])

  // Escape key closes
  useEffect(() => {
    if (!visible) return
    const onKey = (e) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, dismiss])

  async function submit(e) {
    e?.preventDefault()
    if (!email || !email.includes('@')) return
    setStatus('loading')
    try {
      await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'first-visit-modal', list_id: 'XRXk4q' }),
      })
    } catch { /* Klaviyo dedupes server-side; treat as success */ }
    localStorage.setItem(SUBSCRIBED_KEY, '1')
    setStatus('success')
    setTimeout(() => setVisible(false), 2200)
  }

  if (!visible) return null

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(2, 6, 18, 0.78)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      role="dialog" aria-modal="true" aria-label="Subscribe to AirDate Weekly"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 440,
          background: 'linear-gradient(160deg, #0d1526 0%, #0a0f1d 100%)',
          border: '1px solid rgba(45, 212, 218, 0.25)', borderRadius: 16,
          padding: '36px 32px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          color: '#e8ecf4', textAlign: 'center',
        }}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12, width: 32, height: 32,
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
            color: '#8b94a7', fontSize: 18, lineHeight: 1, cursor: 'pointer',
          }}
        >
          ×
        </button>

        {status === 'success' ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>You're in!</h2>
            <p style={{ margin: 0, color: '#8b94a7', fontSize: 14 }}>
              Watch your inbox for this week's top premieres.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📺</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>
              Track TV Premieres Before They Trend
            </h2>
            <p style={{ margin: '0 0 20px', color: '#8b94a7', fontSize: 14, lineHeight: 1.5 }}>
              Get the AirDate Weekly — every major premiere, renewal, and trailer, in one email every Sunday. Free.
            </p>
            <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoFocus
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)', color: '#e8ecf4',
                  fontSize: 14, outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  padding: '12px 20px', borderRadius: 10, border: 'none',
                  background: '#2dd4da', color: '#04121a', fontWeight: 700,
                  fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
                  opacity: status === 'loading' ? 0.6 : 1,
                }}
              >
                {status === 'loading' ? '...' : 'Subscribe'}
              </button>
            </form>
            <p style={{ margin: '14px 0 0', color: '#5b6478', fontSize: 11 }}>
              No spam. Unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
