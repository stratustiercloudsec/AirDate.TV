// src/pages/auth/SignUpPage.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, buildGoogleAuthUrl } from '@/context/AuthContext'

const PW_RULES = [
  { label: 'At least 8 characters',          test: p => p.length >= 8 },
  { label: 'One uppercase letter (A–Z)',      test: p => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a–z)',      test: p => /[a-z]/.test(p) },
  { label: 'One number (0–9)',                test: p => /\d/.test(p) },
  { label: 'One special character (!@#$…)',   test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

function friendlyError(err) {
  const code = err?.code || err?.__type || ''
  const map  = {
    UsernameExistsException:   'An account with this email already exists.',
    InvalidPasswordException:  'Password does not meet the requirements below.',
    InvalidParameterException: err?.message || 'Please check your information.',
    TooManyRequestsException:  'Too many requests — please wait a moment.',
  }
  return map[code] ?? err?.message ?? 'Sign up failed. Please try again.'
}

export function SignUpPage() {
  const { signUp }  = useAuth()
  const navigate    = useNavigate()

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [focused,  setFocused]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const passedRules = PW_RULES.filter(r => r.test(password)).length
  const strengthPct = (passedRules / PW_RULES.length) * 100
  const strengthColor =
    passedRules <= 2 ? 'bg-red-500'
    : passedRules <= 3 ? 'bg-amber-500'
    : passedRules === 4 ? 'bg-yellow-400'
    : 'bg-cyan-500'
  const strengthLabel =
    !password ? ''
    : passedRules <= 2 ? 'Weak'
    : passedRules <= 3 ? 'Fair'
    : passedRules === 4 ? 'Good'
    : 'Strong'

  async function handleSubmit(e) {
    e.preventDefault()
    if (passedRules < PW_RULES.length) { setError('Please meet all password requirements.'); return }
    setError(''); setLoading(true)
    try {
      await signUp(email.trim().toLowerCase(), password, name.trim())
      navigate('/auth/verify', { state: { email: email.trim().toLowerCase() } })
    } catch (err) {
      setError(friendlyError(err))
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center px-4 py-12">

      <a href="/" className="flex flex-col items-center mb-10 group">
        <img
          src="/assets/images/official-airdate-logo.png" alt="AirDate"
          className="h-14 w-auto object-contain mb-1 group-hover:opacity-80 transition-opacity"
        />
        <p className="text-slate-500 text-xs tracking-widest uppercase font-bold">
          Track TV Premieres Before They Trend
        </p>
      </a>

      <div className="w-full max-w-[400px]">
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h1 className="text-2xl font-black text-white tracking-tight mb-1">Create your account</h1>
          <p className="text-slate-400 text-sm mb-7">Free forever · No credit card needed</p>

          {/* Google */}
          <button
            type="button"
            onClick={() => { window.location.href = buildGoogleAuthUrl('/') }}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-slate-100 border border-white/20 rounded-xl transition-all font-bold text-slate-800 text-sm mb-5"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/8"/>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">or with email</span>
            <div className="flex-1 h-px bg-white/8"/>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <i className="fa-solid fa-circle-exclamation text-red-400 text-sm flex-shrink-0 mt-0.5"/>
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Display name
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" autoComplete="name"
                className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Email address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" required
                className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused(true)}
                  placeholder="Create a strong password" autoComplete="new-password" required
                  className="w-full px-4 py-3 pr-11 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
                />
                <button
                  type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-sm`}/>
                </button>
              </div>

              {/* Strength meter */}
              {(focused || password) && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${strengthColor}`}
                        style={{ width: `${strengthPct}%` }}
                      />
                    </div>
                    {strengthLabel && (
                      <span className={`text-[10px] font-black uppercase tracking-widest flex-shrink-0 ${
                        passedRules <= 2 ? 'text-red-400'
                        : passedRules <= 3 ? 'text-amber-400'
                        : passedRules === 4 ? 'text-yellow-400'
                        : 'text-cyan-400'
                      }`}>{strengthLabel}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {PW_RULES.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <i className={`fa-solid text-[9px] flex-shrink-0 transition-colors
                          ${rule.test(password) ? 'fa-check text-cyan-400' : 'fa-circle text-slate-700'}`}/>
                        <span className={`text-[10px] font-bold transition-colors
                          ${rule.test(password) ? 'text-slate-300' : 'text-slate-600'}`}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 mt-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"/>Creating account…</>
                : 'Create Account'
              }
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
