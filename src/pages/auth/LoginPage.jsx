// src/pages/auth/LoginPage.jsx
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, buildGoogleAuthUrl } from '@/context/AuthContext'

function friendlyError(err) {
  const code = err?.code || err?.__type || ''
  const map  = {
    NotAuthorizedException:        'Incorrect email or password.',
    UserNotFoundException:          'No account found with that email.',
    UserNotConfirmedException:      null,     // handled below — redirect to verify
    PasswordResetRequiredException: 'You need to reset your password.',
    TooManyRequestsException:       'Too many attempts — please wait a moment and try again.',
    InvalidParameterException:      'Please check your email and try again.',
  }
  return map[code] ?? err?.message ?? 'Sign in failed. Please try again.'
}

function GoogleButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-slate-100 border border-white/20 rounded-xl transition-all font-bold text-slate-800 text-sm"
    >
      {/* Google G SVG */}
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </button>
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = location.state?.from || '/'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Success banners from other auth flows
  const verified     = location.state?.verified
  const passwordReset = location.state?.passwordReset

  useEffect(() => {
    if (verified || passwordReset) {
      const t = setTimeout(() => window.history.replaceState({}, '', window.location.pathname), 5000)
      return () => clearTimeout(t)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setError(''); setLoading(true)
    try {
      const result = await signIn(email.trim().toLowerCase(), password)
      if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
        navigate('/auth/new-password', { state: { email, session: result.session } })
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      if ((err?.code || err?.__type) === 'UserNotConfirmedException') {
        navigate('/auth/verify', { state: { email: email.trim().toLowerCase() } })
        return
      }
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    window.location.href = buildGoogleAuthUrl(from)
  }

  return (
    <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <a href="/" className="flex flex-col items-center mb-10 group">
        <img
          src="/assets/images/official-airdate-logo.png"
          alt="AirDate"
          className="h-14 w-auto object-contain mb-1 group-hover:opacity-80 transition-opacity"
        />
        <p className="text-slate-500 text-xs tracking-widest uppercase font-bold">
          Track TV Premieres Before They Trend
        </p>
      </a>

      <div className="w-full max-w-[400px]">
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">

          {/* Success banners */}
          {verified && (
            <div className="mb-5 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
              <i className="fa-solid fa-circle-check text-green-400 text-sm flex-shrink-0"/>
              <p className="text-green-300 text-sm font-medium">Email verified! Sign in to continue.</p>
            </div>
          )}
          {passwordReset && (
            <div className="mb-5 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
              <i className="fa-solid fa-circle-check text-green-400 text-sm flex-shrink-0"/>
              <p className="text-green-300 text-sm font-medium">Password updated! Sign in with your new password.</p>
            </div>
          )}

          <h1 className="text-2xl font-black text-white tracking-tight mb-1">Welcome back</h1>
          <p className="text-slate-400 text-sm mb-7">Sign in to your AirDate account</p>

          {/* Google OAuth */}
          <GoogleButton onClick={handleGoogle}/>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/8"/>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">or continue with email</span>
            <div className="flex-1 h-px bg-white/8"/>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <i className="fa-solid fa-circle-exclamation text-red-400 text-sm flex-shrink-0 mt-0.5"/>
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Password
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="text-[10px] font-black uppercase tracking-widest text-cyan-500 hover:text-cyan-400 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required
                  className="w-full px-4 py-3 pr-11 bg-slate-800/60 border border-white/10 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
                />
                <button
                  type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-sm`}/>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 mt-1 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"/>Signing in…</>
                : 'Sign In'
              }
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            New to AirDate?{' '}
            <Link to="/auth/signup" className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors">
              Create a free account →
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-5">
          By signing in you agree to our{' '}
          <a href="/terms" className="hover:text-slate-400 transition-colors">Terms</a>
          {' & '}
          <a href="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}
