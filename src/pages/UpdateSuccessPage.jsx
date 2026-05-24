// src/pages/UpdateSuccessPage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function UpdateSuccessPage() {
  const { user } = useAuth()
  const [refreshed, setRefreshed] = useState(false)

  useEffect(() => {
    // Force token refresh so custom:tier reflects Pro immediately
    const SKEY = 'airdate_session'
    async function forceRefresh() {
      try {
        const stored = JSON.parse(localStorage.getItem(SKEY) || 'null')
        if (!stored?.RefreshToken) return

        const params = new URLSearchParams({
          grant_type:    'refresh_token',
          client_id:     stored.clientId || import.meta.env.VITE_COGNITO_CLIENT_ID,
          refresh_token: stored.RefreshToken,
        })

        const res = await fetch(
          `https://${import.meta.env.VITE_COGNITO_DOMAIN}/oauth2/token`,
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params }
        )
        const data = await res.json()
        if (data.access_token) {
          const updated = { ...stored, AccessToken: data.access_token, IdToken: data.id_token }
          localStorage.setItem(SKEY, JSON.stringify(updated))
          setRefreshed(true)
          // Reload so AuthContext picks up new tier
          window.location.replace('/account')
        }
      } catch (e) {
        console.warn('Token refresh failed:', e)
        setRefreshed(true)
      }
    }

    // Small delay to let webhook finish updating Cognito
    const t = setTimeout(forceRefresh, 2000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-24 h-24 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto mb-8">
          <i className="fa-solid fa-bolt text-cyan-400 text-4xl"></i>
        </div>
        <h1 className="text-4xl font-black text-white mb-4">You're Pro Now</h1>
        <p className="text-slate-200 mb-2">Your account has been upgraded. Unlimited tracking, early alerts, and full Scoop access are now active.</p>
        <p className="text-slate-400 text-sm mb-10">
          {refreshed ? 'Redirecting to your account...' : 'Refreshing your session...'}
        </p>
        <div className="flex flex-col gap-3">
          <Link to="/" className="h-12 bg-cyan-500 text-slate-950 font-black rounded-xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all">
            <i className="fa-solid fa-house"></i> Back to AirDate
          </Link>
          <Link to="/account" className="h-12 bg-slate-800 border border-white/10 text-white font-bold rounded-xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:border-white/30 transition-all">
            View Account
          </Link>
        </div>
      </div>
    </div>
  )
}
