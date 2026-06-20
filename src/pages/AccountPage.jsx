// src/pages/AccountPage.jsx
// v3.1 — Profile, Subscription, Cancellation Status, Password, Session, Downgrade, Guest, Danger Zone
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'
import { Footer } from '@/components/layout/Footer'

const PW_RULES = [
  { label: 'At least 8 characters',  test: p => p.length >= 8 },
  { label: 'One uppercase letter',   test: p => /[A-Z]/.test(p) },
  { label: 'One number',             test: p => /\d/.test(p) },
  { label: 'One special character',  test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-slate-900 rounded-3xl overflow-hidden">
      <div className="px-5 sm:px-6 py-5">
        <h2 className="text-base font-black text-white">{title}</h2>
        {subtitle && <p className="text-slate-200 text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-5 sm:px-6 py-5">{children}</div>
    </div>
  )
}

function SaveButton({ loading, saved, label = 'Save changes' }) {
  return (
    <button type="submit" disabled={loading}
      className={`w-full sm:w-auto px-5 py-2.5 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2
        ${saved ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950'}`}>
      {loading
        ? <><div className="w-3.5 h-3.5 border-2 border-current/20 border-t-current rounded-full animate-spin"/>Saving...</>
        : saved ? <><i className="fa-solid fa-check text-xs"/>Saved</> : label}
    </button>
  )
}

export function AccountPage() {
  const { user, token, signOut, updateProfile, changePassword } = useAuth()
  const navigate = useNavigate()

  const [name,          setName]          = useState(user?.name || '')
  const [nameLoading,   setNameLoading]   = useState(false)
  const [nameSaved,     setNameSaved]     = useState(false)
  const [nameError,     setNameError]     = useState('')
  const [oldPw,         setOldPw]         = useState('')
  const [newPw,         setNewPw]         = useState('')
  const [confirmPw,     setConfirmPw]     = useState('')
  const [showOld,       setShowOld]       = useState(false)
  const [showNew,       setShowNew]       = useState(false)
  const [pwLoading,     setPwLoading]     = useState(false)
  const [pwSaved,       setPwSaved]       = useState(false)
  const [pwError,       setPwError]       = useState('')
  const [pwFocused,     setPwFocused]     = useState(false)
  const [deleteModal,   setDeleteModal]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState('')
  const [guestModal,    setGuestModal]    = useState(false)
  const [guestLoading,  setGuestLoading]  = useState(false)
  const [guestError,    setGuestError]    = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError,   setPortalError]   = useState('')
  const [userData,      setUserData]      = useState(null)

  const passedRules  = PW_RULES.filter(r => r.test(newPw)).length
  const isGoogleUser = user?.provider === 'Google'
  const isPro        = user?.tier === 'pro' || user?.tier === 'premium'

  // Pull the full user record so we can read cancellation state (cancel_at_period_end,
  // subscription_period_end) that the token/AuthContext alone doesn't carry.
  function refreshUserData() {
    if (!token || !user?.sub) return
    fetch(`${API_BASE}/user/${user.sub}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setUserData(d.Item ?? d) })
      .catch(() => {})
  }

  useEffect(() => { refreshUserData() }, [token, user?.sub])

  // Stripe billing portal opens in the same tab via window.location.href, so this fires
  // when the user navigates back (e.g. after cancelling) — refetch to pick up the change.
  useEffect(() => {
    function onFocus() { refreshUserData() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [token, user?.sub])

  const cancelAtPeriodEnd  = !!userData?.cancel_at_period_end
  const periodEndDate      = userData?.subscription_period_end
    ? new Date(userData.subscription_period_end * 1000)
    : null
  const periodEndFormatted = periodEndDate
    ? periodEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  async function openBillingPortal() {
    setPortalLoading(true); setPortalError('')
    try {
      let authToken = token
      if (!authToken) {
        try {
          const s = JSON.parse(localStorage.getItem('airdate_session') || '{}')
          authToken = s.AccessToken || s.accessToken || s.IdToken || s.idToken
        } catch {}
      }
      if (!authToken) { setPortalError('Session expired. Please sign in again.'); setPortalLoading(false); return }
      const res = await fetch('https://qg0x31ranc.execute-api.us-east-1.amazonaws.com/prod/billing-portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_url: window.location.href }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url }
      else setPortalError(data.error || 'Could not open billing portal.')
    } catch { setPortalError('Failed to connect to billing. Try again.') }
    finally { setPortalLoading(false) }
  }

  async function handleSaveName(e) {
    e.preventDefault()
    if (!name.trim()) { setNameError('Name cannot be empty.'); return }
    setNameError(''); setNameLoading(true)
    try {
      await updateProfile({ name: name.trim() })
      setNameSaved(true); setTimeout(() => setNameSaved(false), 3000)
    } catch (err) { setNameError(err?.message || 'Failed to update name.') }
    finally { setNameLoading(false) }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (passedRules < PW_RULES.length) { setPwError("New password doesn't meet all requirements."); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setPwError(''); setPwLoading(true)
    try {
      await changePassword(oldPw, newPw)
      setPwSaved(true); setOldPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) {
      const code = err?.code || err?.__type || ''
      if (code === 'NotAuthorizedException') setPwError('Current password is incorrect.')
      else if (code === 'InvalidPasswordException') setPwError("New password doesn't meet Cognito requirements.")
      else setPwError(err?.message || 'Failed to change password.')
    } finally { setPwLoading(false) }
  }

  async function handleSignOut() { await signOut(); navigate('/') }

  async function confirmDelete() {
    if (deleteConfirm !== 'DELETE') return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/user/${user?.sub}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      await signOut(); navigate('/')
    } catch {
      setDeleteError('Could not delete account. Contact operations@airdate.tv.')
      setDeleteLoading(false); setDeleteModal(false)
    }
  }

  async function confirmGuest() {
    setGuestLoading(true)
    try {
      if (!token || !user?.sub) throw new Error('No user session')
      const res = await fetch(`${API_BASE}/user/${user.sub}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Delete failed')
      setGuestModal(false); await signOut(); navigate('/')
    } catch {
      setGuestError('Could not remove account data. Contact operations@airdate.tv.')
      setGuestLoading(false); setGuestModal(false)
    }
  }

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100">
      <div className="w-full max-w-[1400px] mx-auto px-6 pt-24 sm:pt-28 pb-20 space-y-5 sm:space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">My Account</h1>
            <p className="text-slate-200 text-sm mt-1 truncate">{user?.email}</p>
          </div>
          <span className={`self-start sm:self-auto flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border
            ${isPro
              ? (cancelAtPeriodEnd
                  ? 'bg-orange-500/10 border-orange-500/25 text-orange-400'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-400')
              : 'bg-slate-800 border-white/10 text-slate-200'}`}>
            {isPro ? (cancelAtPeriodEnd ? '★ Pro · Cancelling' : '★ Pro') : 'Free Plan'}
          </span>
        </div>

        {/* Profile */}
        <Section title="Profile" subtitle="Update how your name appears across AirDate.">
          <form onSubmit={handleSaveName} className="space-y-4">
            <div className="flex items-center gap-4 mb-5">
              {user?.picture
                ? <img src={user.picture} alt={user.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-white/10 flex-shrink-0"/>
                : <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-black text-cyan-400">{(user?.name || user?.email || '?')[0].toUpperCase()}</span>
                  </div>
              }
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{user?.name}</p>
                <p className="text-slate-200 text-xs mt-0.5 truncate">{user?.email}</p>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-200 mb-1.5">Display name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"/>
            </div>
            {nameError && <p className="text-red-400 text-xs font-bold">{nameError}</p>}
            <div className="flex justify-end"><SaveButton loading={nameLoading} saved={nameSaved}/></div>
          </form>
        </Section>

        {/* Subscription */}
        <Section title="Subscription" subtitle="Your current plan and usage.">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-white font-bold text-sm">{isPro ? 'AirDate Pro' : 'AirDate Free'}</p>
              <p className="text-slate-200 text-xs mt-0.5">
                {isPro ? 'Unlimited show tracking, early alerts, and more' : 'Track up to 5 shows · Upgrade for unlimited access'}
              </p>
            </div>
            {!isPro && (
              <button onClick={() => navigate('/upgrade')}
                className="w-full sm:w-auto flex-shrink-0 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all">
                Upgrade →
              </button>
            )}
            {isPro && (
              <div className="flex flex-col gap-2">
                <button onClick={openBillingPortal} disabled={portalLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-cyan-500/30 text-slate-200 hover:text-cyan-400 font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-50">
                  {portalLoading
                    ? <><div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin"/>Loading...</>
                    : <><i className="fa-solid fa-credit-card"/>Manage Billing</>}
                </button>
                {portalError && <p className="text-red-400 text-[10px] font-bold text-center">{portalError}</p>}
              </div>
            )}
          </div>

          {isPro && cancelAtPeriodEnd && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-orange-500/10 border border-orange-500/25 rounded-2xl px-4 py-3.5">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-triangle-exclamation text-orange-400 text-sm mt-0.5 flex-shrink-0"/>
                <p className="text-orange-200 text-xs leading-relaxed">
                  Your subscription is set to cancel{periodEndFormatted ? <> on <span className="font-bold text-orange-100">{periodEndFormatted}</span></> : ''}.
                  You'll keep Pro access until then — no further charges after that date.
                </p>
              </div>
              <button onClick={openBillingPortal} disabled={portalLoading}
                className="w-full sm:w-auto flex-shrink-0 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-200 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all">
                Keep My Subscription
              </button>
            </div>
          )}
        </Section>

        {/* Password */}
        {!isGoogleUser && (
          <Section title="Password" subtitle="Update your password. You'll stay signed in on this device.">
            <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-200 mb-1.5">Current password</label>
                <div className="relative">
                  <input type={showOld ? 'text' : 'password'} value={oldPw} onChange={e => setOldPw(e.target.value)}
                    placeholder="Your current password" autoComplete="current-password"
                    className="w-full px-4 py-3 pr-11 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"/>
                  <button type="button" onClick={() => setShowOld(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-200 hover:text-slate-300">
                    <i className={`fa-solid ${showOld ? 'fa-eye-slash' : 'fa-eye'} text-sm`}/>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-200 mb-1.5">New password</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                    onFocus={() => setPwFocused(true)} placeholder="Create new password" autoComplete="new-password"
                    className="w-full px-4 py-3 pr-11 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"/>
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-200 hover:text-slate-300">
                    <i className={`fa-solid ${showNew ? 'fa-eye-slash' : 'fa-eye'} text-sm`}/>
                  </button>
                </div>
                {(pwFocused || newPw) && (
                  <div className="mt-3 grid grid-cols-2 gap-1">
                    {PW_RULES.map((rule, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <i className={`fa-solid text-[9px] ${rule.test(newPw) ? 'fa-check text-cyan-400' : 'fa-circle text-slate-700'}`}/>
                        <span className={`text-[10px] font-bold ${rule.test(newPw) ? 'text-slate-300' : 'text-slate-600'}`}>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-200 mb-1.5">Confirm new password</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password" autoComplete="new-password"
                  className={`w-full px-4 py-3 bg-slate-800/60 border rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all
                    ${confirmPw && newPw !== confirmPw ? 'border-red-500/40' : 'border-white/10 focus:border-cyan-500/40'}`}/>
                {confirmPw && newPw !== confirmPw && <p className="text-red-400 text-[10px] font-bold mt-1">Passwords don't match</p>}
              </div>
              {pwError && <p className="text-red-400 text-xs font-bold">{pwError}</p>}
              <div className="flex justify-end"><SaveButton loading={pwLoading} saved={pwSaved} label="Update password"/></div>
            </form>
          </Section>
        )}

        {isGoogleUser && (
          <Section title="Password" subtitle="Password management.">
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <i className="fa-brands fa-google text-slate-200 flex-shrink-0"/>
              Your account uses Google for authentication. Password changes are managed through your Google account.
            </div>
          </Section>
        )}


        {/* Downgrade — Pro only */}
        {isPro && (
          <Section title="Downgrade to Free" subtitle={cancelAtPeriodEnd ? "Your cancellation is already scheduled." : "Cancel your Pro subscription and return to the free plan. Your account and watchlist are kept."}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-white font-bold text-sm">
                  {cancelAtPeriodEnd ? 'Cancellation Scheduled' : 'Return to Free Plan'}
                </p>
                <p className="text-slate-200 text-xs mt-0.5">
                  {cancelAtPeriodEnd
                    ? `You'll move to the Free plan${periodEndFormatted ? ` on ${periodEndFormatted}` : ' at the end of your billing period'}. Changed your mind? Manage billing to keep Pro.`
                    : "You'll lose unlimited tracking and early alerts. Your data stays safe. Takes effect at end of billing period."}
                </p>
              </div>
              <button onClick={openBillingPortal} disabled={portalLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all flex-shrink-0 disabled:opacity-50">
                {portalLoading
                  ? <><div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin"/>Loading...</>
                  : cancelAtPeriodEnd
                    ? <><i className="fa-solid fa-rotate-left"/>Manage / Reactivate</>
                    : <><i className="fa-solid fa-arrow-down-to-line"/>Manage / Cancel Plan</>}
              </button>
            </div>
            {portalError && <p className="text-red-400 text-[10px] font-bold mt-2">{portalError}</p>}
          </Section>
        )}

        {/* Continue as Guest — Free only */}
        {!isPro && (
          <Section title="Continue as Guest" subtitle="Remove your account data and browse anonymously. Your watchlist will be lost.">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-white font-bold text-sm">Go Anonymous</p>
                <p className="text-slate-200 text-xs mt-0.5">Deletes your profile, watchlist, and preferences. You can still browse AirDate without an account.</p>
              </div>
              <button onClick={() => setGuestModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all flex-shrink-0">
                <i className="fa-solid fa-user-slash"/> Continue as Guest
              </button>
            </div>
          </Section>
        )}

        {/* Session */}
        <Section title="Session">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-white font-bold text-sm">Sign out</p>
              <p className="text-slate-200 text-xs mt-0.5">Sign out from all devices</p>
            </div>
            <button onClick={handleSignOut}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 font-black text-xs uppercase tracking-widest rounded-xl transition-all">
              <i className="fa-solid fa-right-from-bracket"/> Sign Out
            </button>
          </div>
        </Section>

        {/* Danger Zone */}
        <Section title="Danger Zone" subtitle="Permanently delete your account and all associated data.">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-white font-bold text-sm">Delete Account</p>
              <p className="text-slate-200 text-xs mt-0.5">Permanently removes your account, watchlist, and all personal data. Cannot be undone.</p>
            </div>
            <button onClick={() => { setDeleteModal(true); setDeleteConfirm(''); setDeleteError('') }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex-shrink-0">
              <i className="fa-solid fa-trash"/> Delete Account
            </button>
          </div>
        </Section>

      </div>
      <Footer/>

      {guestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setGuestModal(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-slate-700/60 flex items-center justify-center">
                <i className="fa-solid fa-user-slash text-slate-300 text-xl"/>
              </div>
            </div>
            <h3 className="text-white font-black text-xl text-center mb-2">Continue as Guest?</h3>
            <p className="text-slate-200 text-sm text-center mb-4">This will permanently remove your account data. You can create a new account anytime.</p>
            <ul className="space-y-2 mb-5">
              {['Your watchlist will be deleted','Notification preferences removed','You will be signed out immediately'].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-200">
                  <i className="fa-solid fa-xmark text-amber-500/70 w-4"/>{item}
                </li>
              ))}
            </ul>
            {guestError && <p className="text-red-400 text-xs font-bold mb-4 text-center">{guestError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setGuestModal(false)}
                className="flex-1 h-11 bg-slate-800/60 rounded-xl text-slate-300 text-xs font-bold uppercase tracking-widest hover:text-white transition-all">
                Keep Account
              </button>
              <button onClick={confirmGuest} disabled={guestLoading}
                className="flex-1 h-11 bg-slate-700 hover:bg-slate-600 rounded-xl text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50">
                {guestLoading ? <i className="fa-solid fa-spinner fa-spin"/> : <><i className="fa-solid fa-user-slash"/> Go Anonymous</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setDeleteModal(false)}>
          <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mx-auto mb-5 flex items-center justify-center">
              <i className="fa-solid fa-trash text-red-400 text-2xl"/>
            </div>
            <h3 className="text-white font-black text-xl text-center mb-2">Delete Your Account?</h3>
            <p className="text-slate-200 text-sm text-center mb-6 leading-relaxed">
              This will permanently delete everything. <span className="text-red-400 font-bold">Cannot be undone.</span>
            </p>
            <ul className="space-y-2 mb-6 bg-slate-800/40 border border-white/5 rounded-2xl p-4">
              {['Your watchlist will be permanently deleted','Preferences and history removed','Active Pro subscriptions cancelled','You will be signed out immediately'].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-200">
                  <i className="fa-solid fa-xmark text-red-500/70 w-4 flex-shrink-0"/>{item}
                </li>
              ))}
            </ul>
            <div className="mb-6">
              <label className="block text-slate-200 text-xs font-bold uppercase tracking-widest mb-2">
                Type <span className="text-red-400">DELETE</span> to confirm
              </label>
              <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE"
                className="w-full bg-slate-800 border border-white/10 focus:border-red-500/50 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-slate-600 focus:outline-none transition-colors"/>
            </div>
            {deleteError && <p className="text-red-400 text-xs font-bold mb-4 text-center">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(false)}
                className="flex-1 h-12 bg-slate-800 border border-white/10 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleteConfirm !== 'DELETE' || deleteLoading}
                className="flex-1 h-12 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {deleteLoading ? <i className="fa-solid fa-spinner fa-spin"/> : <><i className="fa-solid fa-trash"/> Delete Forever</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}