// src/pages/auth/ProfilePage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Footer } from '@/components/layout/Footer'

const PW_RULES = [
  { label: 'At least 8 characters',         test: p => p.length >= 8 },
  { label: 'One uppercase letter',           test: p => /[A-Z]/.test(p) },
  { label: 'One number',                     test: p => /\d/.test(p) },
  { label: 'One special character',          test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-slate-900 border border-white/8 rounded-3xl overflow-hidden">
      <div className="px-6 py-5 border-b border-white/8">
        <h2 className="text-base font-black text-white">{title}</h2>
        {subtitle && <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function SaveButton({ loading, saved, label = 'Save changes' }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`px-5 py-2.5 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2
        ${saved
          ? 'bg-green-500/20 border border-green-500/30 text-green-400'
          : 'bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950'}`}
    >
      {loading
        ? <><div className="w-3.5 h-3.5 border-2 border-current/20 border-t-current rounded-full animate-spin"/>Saving…</>
        : saved
        ? <><i className="fa-solid fa-check text-xs"/>Saved</>
        : label
      }
    </button>
  )
}

export function ProfilePage() {
  const { user, signOut, updateProfile, changePassword } = useAuth()
  const navigate = useNavigate()

  // ── Profile form ───────────────────────────────────────────────────────
  const [name,       setName]       = useState(user?.name || '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameSaved,   setNameSaved]   = useState(false)
  const [nameError,   setNameError]   = useState('')

  // ── Password form ──────────────────────────────────────────────────────
  const [oldPw,       setOldPw]       = useState('')
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [showOld,     setShowOld]     = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [pwLoading,   setPwLoading]   = useState(false)
  const [pwSaved,     setPwSaved]     = useState(false)
  const [pwError,     setPwError]     = useState('')
  const [pwFocused,   setPwFocused]   = useState(false)

  const passedRules   = PW_RULES.filter(r => r.test(newPw)).length
  const isGoogleUser  = user?.provider === 'Google'

  async function handleSaveName(e) {
    e.preventDefault()
    if (!name.trim()) { setNameError('Name cannot be empty.'); return }
    setNameError(''); setNameLoading(true)
    try {
      await updateProfile({ name: name.trim() })
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 3000)
    } catch (err) {
      setNameError(err?.message || 'Failed to update name.')
    } finally { setNameLoading(false) }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (passedRules < PW_RULES.length) { setPwError('New password doesn\'t meet all requirements.'); return }
    if (newPw !== confirmPw)            { setPwError('Passwords do not match.'); return }
    setPwError(''); setPwLoading(true)
    try {
      await changePassword(oldPw, newPw)
      setPwSaved(true)
      setOldPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) {
      const code = err?.code || err?.__type || ''
      if (code === 'NotAuthorizedException') setPwError('Current password is incorrect.')
      else if (code === 'InvalidPasswordException') setPwError('New password doesn\'t meet Cognito requirements.')
      else setPwError(err?.message || 'Failed to change password.')
    } finally { setPwLoading(false) }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100">
      <div className="w-full max-w-2xl mx-auto px-6 pt-28 pb-20 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">My Account</h1>
            <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
          </div>
          {/* Tier badge */}
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border
            ${user?.tier === 'premium'
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
              : 'bg-slate-800 border-white/10 text-slate-400'}`}>
            {user?.tier === 'premium' ? '★ Premium' : 'Free Plan'}
          </span>
        </div>

        {/* ── Profile info ─────────────────────────────────────────────── */}
        <Section title="Profile" subtitle="Update how your name appears across AirDate.">
          <form onSubmit={handleSaveName} className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-5">
              {user?.picture
                ? <img src={user.picture} alt={user.name} className="w-16 h-16 rounded-2xl object-cover border border-white/10"/>
                : (
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <span className="text-2xl font-black text-cyan-400">
                      {(user?.name || user?.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                )
              }
              <div>
                <p className="text-white font-bold text-sm">{user?.name}</p>
                <p className="text-slate-400 text-xs mt-0.5">{user?.email}</p>
                {isGoogleUser && (
                  <span className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 bg-slate-800 border border-white/8 rounded-lg text-[10px] font-bold text-slate-400">
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google account
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Display name
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>

            {nameError && (
              <p className="text-red-400 text-xs font-bold">{nameError}</p>
            )}

            <div className="flex justify-end">
              <SaveButton loading={nameLoading} saved={nameSaved}/>
            </div>
          </form>
        </Section>

        {/* ── Subscription ─────────────────────────────────────────────── */}
        <Section title="Subscription" subtitle="Your current plan and usage.">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">
                {user?.tier === 'premium' ? 'AirDate Premium' : 'AirDate Free'}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {user?.tier === 'premium'
                  ? 'Unlimited show tracking, early alerts, and more'
                  : 'Track up to 5 shows · Upgrade for unlimited access'}
              </p>
            </div>
            {user?.tier !== 'premium' && (
              <button
                onClick={() => navigate('/upgrade')}
                className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all"
              >
                Upgrade →
              </button>
            )}
          </div>
        </Section>

        {/* ── Change password (email users only) ───────────────────────── */}
        {!isGoogleUser && (
          <Section
            title="Password"
            subtitle="Update your password. You'll stay signed in on this device."
          >
            <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
              {/* Current password */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showOld ? 'text' : 'password'} value={oldPw}
                    onChange={e => setOldPw(e.target.value)}
                    placeholder="Your current password" autoComplete="current-password"
                    className="w-full px-4 py-3 pr-11 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowOld(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
                    <i className={`fa-solid ${showOld ? 'fa-eye-slash' : 'fa-eye'} text-sm`}/>
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'} value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    onFocus={() => setPwFocused(true)}
                    placeholder="Create new password" autoComplete="new-password"
                    className="w-full px-4 py-3 pr-11 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
                    <i className={`fa-solid ${showNew ? 'fa-eye-slash' : 'fa-eye'} text-sm`}/>
                  </button>
                </div>

                {/* Strength rules */}
                {(pwFocused || newPw) && (
                  <div className="mt-3 grid grid-cols-2 gap-1">
                    {PW_RULES.map((rule, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <i className={`fa-solid text-[9px] flex-shrink-0 ${rule.test(newPw) ? 'fa-check text-cyan-400' : 'fa-circle text-slate-700'}`}/>
                        <span className={`text-[10px] font-bold ${rule.test(newPw) ? 'text-slate-300' : 'text-slate-600'}`}>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Confirm new password
                </label>
                <input
                  type="password" value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password" autoComplete="new-password"
                  className={`w-full px-4 py-3 bg-slate-800/60 border rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all
                    ${confirmPw && newPw !== confirmPw
                      ? 'border-red-500/40 focus:border-red-500/60'
                      : 'border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10'}`}
                />
                {confirmPw && newPw !== confirmPw && (
                  <p className="text-red-400 text-[10px] font-bold mt-1">Passwords don't match</p>
                )}
              </div>

              {pwError && <p className="text-red-400 text-xs font-bold">{pwError}</p>}

              <div className="flex justify-end">
                <SaveButton loading={pwLoading} saved={pwSaved} label="Update password"/>
              </div>
            </form>
          </Section>
        )}

        {isGoogleUser && (
          <Section title="Password" subtitle="Password management.">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <i className="fa-brands fa-google text-slate-500"/>
              Your account uses Google for authentication. Password changes are managed through your Google account.
            </div>
          </Section>
        )}

        {/* ── Danger zone ───────────────────────────────────────────────── */}
        <Section title="Session">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">Sign out</p>
              <p className="text-slate-400 text-xs mt-0.5">Sign out from all devices</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 hover:text-red-300 font-black text-xs uppercase tracking-widest rounded-xl transition-all"
            >
              <i className="fa-solid fa-right-from-bracket mr-2"/>
              Sign Out
            </button>
          </div>
        </Section>

      </div>
      <Footer/>
    </div>
  )
}
